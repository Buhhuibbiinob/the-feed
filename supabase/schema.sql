-- Run this in the Supabase SQL editor (Project > SQL Editor > New query) once,
-- after creating your Supabase project.

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists theme text not null default 'default';
-- New signups now default to the iOS Light theme instead of Classic Aqua;
-- this only changes the default for rows inserted from now on.
alter table public.profiles alter column theme set default 'ios-light';
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists banner_url text;
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists banned boolean not null default false;

-- "Currently listening / watching" status, manually set by the user.
alter table public.profiles add column if not exists status_media_type text check (status_media_type in ('music', 'movie_tv'));
alter table public.profiles add column if not exists status_title text;
alter table public.profiles add column if not exists status_artist text;
alter table public.profiles add column if not exists status_cover_url text;
alter table public.profiles add column if not exists status_updated_at timestamptz;

-- Per-user custom site background image, used by the "custom" theme.
alter table public.profiles add column if not exists custom_background_url text;

-- Grant the site owner admin access. Safe to re-run.
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'amaiyamedley@gmail.com');

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Without this, admin actions like banning a user or granting the artist
-- "blue check" silently update zero rows: the owner-only policy above blocks
-- an admin from updating anyone else's profile row.
drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile"
  on public.profiles for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Case-insensitive uniqueness so "Dyamanite" and "dyamanite" can't both
-- be taken; the plain `unique` constraint above only guards exact case.
create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

-- Auto-create a profile row whenever a new user signs up.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- posts (feed / reviews) ----------
do $$ begin
  create type media_type as enum ('music', 'movie', 'tv');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_type media_type not null,
  title text not null,
  body text not null,
  rating smallint check (rating between 1 and 5),
  created_at timestamptz not null default now()
);

alter table public.posts enable row level security;

drop policy if exists "Posts are viewable by everyone" on public.posts;
create policy "Posts are viewable by everyone"
  on public.posts for select
  using (true);

drop policy if exists "Users can insert their own posts" on public.posts;
create policy "Users can insert their own posts"
  on public.posts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own posts" on public.posts;
create policy "Users can update their own posts"
  on public.posts for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own posts" on public.posts;
create policy "Users can delete their own posts"
  on public.posts for delete
  using (auth.uid() = user_id);

-- ---------- chat_messages (live chat) ----------
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

drop policy if exists "Chat messages are viewable by everyone" on public.chat_messages;
create policy "Chat messages are viewable by everyone"
  on public.chat_messages for select
  using (true);

drop policy if exists "Users can insert their own chat messages" on public.chat_messages;
create policy "Users can insert their own chat messages"
  on public.chat_messages for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own chat messages" on public.chat_messages;
create policy "Users can delete their own chat messages"
  on public.chat_messages for delete
  using (auth.uid() = user_id);

drop policy if exists "Admins can delete any chat message" on public.chat_messages;
create policy "Admins can delete any chat message"
  on public.chat_messages for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Turn on Realtime so new chat messages push to connected clients.
do $$ begin
  alter publication supabase_realtime add table public.chat_messages;
exception
  when duplicate_object then null;
end $$;

-- ---------- message_reports (chat moderation) ----------
create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.message_reports enable row level security;

drop policy if exists "Users can insert their own reports" on public.message_reports;
create policy "Users can insert their own reports"
  on public.message_reports for insert
  with check (auth.uid() = reporter_id);

drop policy if exists "Admins can view reports" on public.message_reports;
create policy "Admins can view reports"
  on public.message_reports for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "Admins can delete reports" on public.message_reports;
create policy "Admins can delete reports"
  on public.message_reports for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ---------- blocked_users (chat moderation) ----------
create table if not exists public.blocked_users (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocked_users enable row level security;

drop policy if exists "Users can view their own blocks" on public.blocked_users;
create policy "Users can view their own blocks"
  on public.blocked_users for select
  using (auth.uid() = blocker_id);

drop policy if exists "Users can insert their own blocks" on public.blocked_users;
create policy "Users can insert their own blocks"
  on public.blocked_users for insert
  with check (auth.uid() = blocker_id);

drop policy if exists "Users can delete their own blocks" on public.blocked_users;
create policy "Users can delete their own blocks"
  on public.blocked_users for delete
  using (auth.uid() = blocker_id);

-- ---------- posts: optional Spotify track metadata ----------
alter table public.posts add column if not exists artist text;
alter table public.posts add column if not exists cover_url text;
alter table public.posts add column if not exists spotify_track_id text;

-- ---------- spotify_accounts (OAuth tokens) ----------
create table if not exists public.spotify_accounts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  spotify_user_id text not null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.spotify_accounts enable row level security;

drop policy if exists "Users can view their own spotify account" on public.spotify_accounts;
create policy "Users can view their own spotify account"
  on public.spotify_accounts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own spotify account" on public.spotify_accounts;
create policy "Users can insert their own spotify account"
  on public.spotify_accounts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own spotify account" on public.spotify_accounts;
create policy "Users can update their own spotify account"
  on public.spotify_accounts for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own spotify account" on public.spotify_accounts;
create policy "Users can delete their own spotify account"
  on public.spotify_accounts for delete
  using (auth.uid() = user_id);

-- ---------- posts: optional YouTube video reference ----------
alter table public.posts add column if not exists youtube_video_id text;

-- ---------- posts: consolidate "movie" and "tv" into a single "movie_tv" category ----------
-- Switch media_type from an enum to plain text with a check constraint, since
-- Postgres enums can't merge two values into one without recreating the type.
alter table public.posts alter column media_type type text using media_type::text;
update public.posts set media_type = 'movie_tv' where media_type in ('movie', 'tv');
alter table public.posts drop constraint if exists posts_media_type_check;
alter table public.posts add constraint posts_media_type_check check (media_type in ('music', 'movie_tv'));
drop type if exists media_type;

-- ---------- youtube_accounts (OAuth tokens) ----------
create table if not exists public.youtube_accounts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  youtube_channel_id text not null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.youtube_accounts enable row level security;

drop policy if exists "Users can view their own youtube account" on public.youtube_accounts;
create policy "Users can view their own youtube account"
  on public.youtube_accounts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own youtube account" on public.youtube_accounts;
create policy "Users can insert their own youtube account"
  on public.youtube_accounts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own youtube account" on public.youtube_accounts;
create policy "Users can update their own youtube account"
  on public.youtube_accounts for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own youtube account" on public.youtube_accounts;
create policy "Users can delete their own youtube account"
  on public.youtube_accounts for delete
  using (auth.uid() = user_id);

-- ---------- comments (top-level + one level of replies) ----------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  parent_comment_id uuid references public.comments (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.comments enable row level security;

drop policy if exists "Comments are viewable by everyone" on public.comments;
create policy "Comments are viewable by everyone"
  on public.comments for select
  using (true);

drop policy if exists "Users can insert their own comments" on public.comments;
create policy "Users can insert their own comments"
  on public.comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own comments" on public.comments;
create policy "Users can update their own comments"
  on public.comments for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own comments" on public.comments;
create policy "Users can delete their own comments"
  on public.comments for delete
  using (auth.uid() = user_id);

-- ---------- likes (one like per person per post) ----------
create table if not exists public.likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.likes enable row level security;

drop policy if exists "Likes are viewable by everyone" on public.likes;
create policy "Likes are viewable by everyone"
  on public.likes for select
  using (true);

drop policy if exists "Users can insert their own likes" on public.likes;
create policy "Users can insert their own likes"
  on public.likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own likes" on public.likes;
create policy "Users can delete their own likes"
  on public.likes for delete
  using (auth.uid() = user_id);

-- ---------- follows (one profile following another) ----------
create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followed_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

alter table public.follows enable row level security;

drop policy if exists "Follows are viewable by everyone" on public.follows;
create policy "Follows are viewable by everyone"
  on public.follows for select
  using (true);

drop policy if exists "Users can insert their own follows" on public.follows;
create policy "Users can insert their own follows"
  on public.follows for insert
  with check (auth.uid() = follower_id);

drop policy if exists "Users can delete their own follows" on public.follows;
create policy "Users can delete their own follows"
  on public.follows for delete
  using (auth.uid() = follower_id);

-- ---------- avatars storage bucket (profile pictures + banners) ----------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Any signed-in user can upload / replace / delete images anywhere in the
-- avatars bucket (profile pictures, banners, backgrounds, club assets).
-- This is a small trusted community, so we deliberately trade strict
-- per-owner path isolation for uploads that just work — this is what
-- clears the "new row violates row-level security policy" error. The
-- bucket is created with no allowed_mime_types restriction, so every
-- image format (png, jpg, heic, webp, gif, …) is accepted.
drop policy if exists "Users can upload their own avatar" on storage.objects;
drop policy if exists "Admins can upload club assets" on storage.objects;
drop policy if exists "Admins and club owners can upload club assets" on storage.objects;
drop policy if exists "Signed-in users can upload avatars" on storage.objects;
create policy "Signed-in users can upload avatars"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars');

drop policy if exists "Users can update their own avatar" on storage.objects;
drop policy if exists "Admins can update club assets" on storage.objects;
drop policy if exists "Admins and club owners can update club assets" on storage.objects;
drop policy if exists "Signed-in users can update avatars" on storage.objects;
create policy "Signed-in users can update avatars"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars')
  with check (bucket_id = 'avatars');

drop policy if exists "Users can delete their own avatar" on storage.objects;
drop policy if exists "Signed-in users can delete avatars" on storage.objects;
create policy "Signed-in users can delete avatars"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars');

-- ---------- clubs (fan clubs for artists, bands, movies, shows) ----------
create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  media_type text not null check (media_type in ('music', 'movie_tv')),
  name text not null,
  slug text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists clubs_media_type_slug_idx on public.clubs (media_type, slug);

-- New clubs start out pending so an admin can review them before they're
-- listed publicly; existing rows default to approved so nothing already
-- live gets hidden by this migration.
alter table public.clubs add column if not exists status text not null default 'approved' check (status in ('pending', 'approved', 'banned'));
alter table public.clubs add column if not exists banner_url text;
alter table public.clubs add column if not exists avatar_url text;

-- Whoever creates a club (manually, or automatically via the first post about
-- an artist/show) is its "club admin" and can manage its banner/avatar; null
-- for older auto-created clubs from before this column existed.
alter table public.clubs add column if not exists created_by uuid references public.profiles (id) on delete set null;

alter table public.clubs enable row level security;

drop policy if exists "Clubs are viewable by everyone" on public.clubs;
create policy "Clubs are viewable by everyone"
  on public.clubs for select
  using (true);

drop policy if exists "Signed-in users can create clubs" on public.clubs;
create policy "Signed-in users can create clubs"
  on public.clubs for insert
  with check (auth.uid() is not null and (created_by is null or created_by = auth.uid()));

drop policy if exists "Admins can update clubs" on public.clubs;
create policy "Admins can update clubs"
  on public.clubs for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Lets a club's creator manage their own club (banner/avatar); a trigger below
-- stops them from touching `status` (approve/ban is site-admin only).
drop policy if exists "Club creators can update their own club" on public.clubs;
create policy "Club creators can update their own club"
  on public.clubs for update
  using (auth.uid() = created_by);

-- Site admins always have final say: silently revert any attempt by a
-- non-admin to change a club's status through their update access above.
create or replace function public.enforce_club_status_change()
returns trigger as $$
begin
  if new.status is distinct from old.status
     and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin) then
    new.status := old.status;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists clubs_enforce_status_change on public.clubs;
create trigger clubs_enforce_status_change
  before update on public.clubs
  for each row execute procedure public.enforce_club_status_change();

-- Club banner/avatar uploads are covered by the permissive
-- "Signed-in users can upload/update avatars" policies above, so the older
-- admin-only and club-owner-scoped storage policies are no longer needed.
-- Drop any lingering ones so they can't narrow access.
drop policy if exists "Admins can upload club assets" on storage.objects;
drop policy if exists "Admins and club owners can upload club assets" on storage.objects;
drop policy if exists "Admins can update club assets" on storage.objects;
drop policy if exists "Admins and club owners can update club assets" on storage.objects;

drop policy if exists "Admins can delete clubs" on public.clubs;
create policy "Admins can delete clubs"
  on public.clubs for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ---------- club_reports (report a fan club for admin review) ----------
create table if not exists public.club_reports (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.club_reports enable row level security;

drop policy if exists "Users can report clubs" on public.club_reports;
create policy "Users can report clubs"
  on public.club_reports for insert
  with check (auth.uid() = reporter_id);

drop policy if exists "Admins can view club reports" on public.club_reports;
create policy "Admins can view club reports"
  on public.club_reports for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "Admins can delete club reports" on public.club_reports;
create policy "Admins can delete club reports"
  on public.club_reports for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Messages with a club_id belong to that club's chat room instead of the
-- site-wide Live Chat; null stays the global room.
alter table public.chat_messages add column if not exists club_id uuid references public.clubs (id) on delete cascade;
create index if not exists chat_messages_club_id_idx on public.chat_messages (club_id);

-- ---------- club_members (join/leave a fan club) ----------
create table if not exists public.club_members (
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

alter table public.club_members enable row level security;

drop policy if exists "Club members are viewable by everyone" on public.club_members;
create policy "Club members are viewable by everyone"
  on public.club_members for select
  using (true);

drop policy if exists "Users can join clubs" on public.club_members;
create policy "Users can join clubs"
  on public.club_members for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can leave clubs" on public.club_members;
create policy "Users can leave clubs"
  on public.club_members for delete
  using (auth.uid() = user_id);

-- ---------- posts: link to the auto-created fan club for its artist/title ----------
alter table public.posts add column if not exists club_id uuid references public.clubs (id) on delete set null;

-- ---------- club_events (meetups/watch-parties/listening parties for a club) ----------
create table if not exists public.club_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  location text,
  event_time timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.club_events add column if not exists flyer_url text;

create index if not exists club_events_club_id_idx on public.club_events (club_id, event_time);

alter table public.club_events enable row level security;

drop policy if exists "Club events are viewable by everyone" on public.club_events;
create policy "Club events are viewable by everyone"
  on public.club_events for select
  using (true);

drop policy if exists "Club members can create events" on public.club_events;
create policy "Club members can create events"
  on public.club_events for insert
  with check (
    auth.uid() = created_by
    and auth.uid() in (select user_id from public.club_members where club_id = club_events.club_id)
  );

drop policy if exists "Event creators can delete their events" on public.club_events;
create policy "Event creators can delete their events"
  on public.club_events for delete
  using (auth.uid() = created_by);

-- ---------- club_event_rsvps (going / maybe / not going) ----------
create table if not exists public.club_event_rsvps (
  event_id uuid not null references public.club_events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('going', 'maybe', 'not_going')),
  responded_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.club_event_rsvps enable row level security;

drop policy if exists "Event RSVPs are viewable by everyone" on public.club_event_rsvps;
create policy "Event RSVPs are viewable by everyone"
  on public.club_event_rsvps for select
  using (true);

drop policy if exists "Users can set their own RSVP" on public.club_event_rsvps;
create policy "Users can set their own RSVP"
  on public.club_event_rsvps for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own RSVP" on public.club_event_rsvps;
create policy "Users can update their own RSVP"
  on public.club_event_rsvps for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own RSVP" on public.club_event_rsvps;
create policy "Users can remove their own RSVP"
  on public.club_event_rsvps for delete
  using (auth.uid() = user_id);

-- ---------- collections (user-curated lists of posts) ----------
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

alter table public.collections enable row level security;

drop policy if exists "Collections are viewable by everyone" on public.collections;
create policy "Collections are viewable by everyone"
  on public.collections for select
  using (true);

drop policy if exists "Users can create their own collections" on public.collections;
create policy "Users can create their own collections"
  on public.collections for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own collections" on public.collections;
create policy "Users can update their own collections"
  on public.collections for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own collections" on public.collections;
create policy "Users can delete their own collections"
  on public.collections for delete
  using (auth.uid() = user_id);

-- ---------- collection_posts (posts saved into a collection) ----------
create table if not exists public.collection_posts (
  collection_id uuid not null references public.collections (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, post_id)
);

alter table public.collection_posts enable row level security;

drop policy if exists "Collection posts are viewable by everyone" on public.collection_posts;
create policy "Collection posts are viewable by everyone"
  on public.collection_posts for select
  using (true);

drop policy if exists "Users can add posts to their own collections" on public.collection_posts;
create policy "Users can add posts to their own collections"
  on public.collection_posts for insert
  with check (
    auth.uid() in (select user_id from public.collections where id = collection_id)
  );

drop policy if exists "Users can remove posts from their own collections" on public.collection_posts;
create policy "Users can remove posts from their own collections"
  on public.collection_posts for delete
  using (
    auth.uid() in (select user_id from public.collections where id = collection_id)
  );

-- ---------- artist verification ("blue check", admin-granted after review) ----------
alter table public.profiles add column if not exists is_verified_artist boolean not null default false;

-- ---------- artist_posts (self-serve board for unsigned/underground artists and
-- filmmakers to share a Spotify/SoundCloud/Apple Music/YouTube link; visible
-- immediately like a normal post, but admins can ban or delete it after the fact) ----------
create table if not exists public.artist_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  artist_name text not null,
  platform text not null check (platform in ('spotify', 'soundcloud', 'apple_music', 'youtube')),
  link_url text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'banned')),
  created_at timestamptz not null default now()
);

-- Widen the allowed platforms to include YouTube for filmmakers/short films;
-- safe to re-run against a table created before this column existed.
alter table public.artist_posts drop constraint if exists artist_posts_platform_check;
alter table public.artist_posts add constraint artist_posts_platform_check
  check (platform in ('spotify', 'soundcloud', 'apple_music', 'youtube'));

create index if not exists artist_posts_created_at_idx on public.artist_posts (created_at desc);

alter table public.artist_posts enable row level security;

drop policy if exists "Artist posts are viewable by everyone" on public.artist_posts;
create policy "Artist posts are viewable by everyone"
  on public.artist_posts for select
  using (true);

drop policy if exists "Users can create artist posts" on public.artist_posts;
create policy "Users can create artist posts"
  on public.artist_posts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own artist posts" on public.artist_posts;
create policy "Users can delete their own artist posts"
  on public.artist_posts for delete
  using (auth.uid() = user_id);

drop policy if exists "Admins can update artist posts" on public.artist_posts;
create policy "Admins can update artist posts"
  on public.artist_posts for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "Admins can delete artist posts" on public.artist_posts;
create policy "Admins can delete artist posts"
  on public.artist_posts for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ---------- artist_post_comments (replies on an artist post) ----------
create table if not exists public.artist_post_comments (
  id uuid primary key default gen_random_uuid(),
  artist_post_id uuid not null references public.artist_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists artist_post_comments_post_id_idx on public.artist_post_comments (artist_post_id);

alter table public.artist_post_comments enable row level security;

drop policy if exists "Artist post comments are viewable by everyone" on public.artist_post_comments;
create policy "Artist post comments are viewable by everyone"
  on public.artist_post_comments for select
  using (true);

drop policy if exists "Users can comment on artist posts" on public.artist_post_comments;
create policy "Users can comment on artist posts"
  on public.artist_post_comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own artist post comments" on public.artist_post_comments;
create policy "Users can delete their own artist post comments"
  on public.artist_post_comments for delete
  using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- ---------- artist_post_reports (report an artist post for admin review) ----------
create table if not exists public.artist_post_reports (
  id uuid primary key default gen_random_uuid(),
  artist_post_id uuid not null references public.artist_posts (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.artist_post_reports enable row level security;

drop policy if exists "Users can report artist posts" on public.artist_post_reports;
create policy "Users can report artist posts"
  on public.artist_post_reports for insert
  with check (auth.uid() = reporter_id);

drop policy if exists "Admins can view artist post reports" on public.artist_post_reports;
create policy "Admins can view artist post reports"
  on public.artist_post_reports for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "Admins can delete artist post reports" on public.artist_post_reports;
create policy "Admins can delete artist post reports"
  on public.artist_post_reports for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ---------- site_content (admin-editable page taglines/blurbs) ----------
create table if not exists public.site_content (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.site_content enable row level security;

drop policy if exists "Site content is viewable by everyone" on public.site_content;
create policy "Site content is viewable by everyone"
  on public.site_content for select
  using (true);

drop policy if exists "Admins can insert site content" on public.site_content;
create policy "Admins can insert site content"
  on public.site_content for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "Admins can update site content" on public.site_content;
create policy "Admins can update site content"
  on public.site_content for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ---------- waitlist_signups ("get notified" email capture on sign-up page) ----------
create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists waitlist_signups_email_lower_idx
  on public.waitlist_signups (lower(email));

alter table public.waitlist_signups enable row level security;

drop policy if exists "Anyone can join the waitlist" on public.waitlist_signups;
create policy "Anyone can join the waitlist"
  on public.waitlist_signups for insert
  with check (true);

drop policy if exists "Admins can view waitlist signups" on public.waitlist_signups;
create policy "Admins can view waitlist signups"
  on public.waitlist_signups for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ---------- banner_ads (sidebar ad slots: artist/band submissions, admin-approved) ----------
create table if not exists public.banner_ads (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references public.profiles (id) on delete set null,
  artist_name text not null,
  link_url text not null,
  image_url text,
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.banner_ads enable row level security;

drop policy if exists "Approved banners are viewable by everyone" on public.banner_ads;
create policy "Approved banners are viewable by everyone"
  on public.banner_ads for select
  using (
    status = 'approved'
    or submitted_by = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

drop policy if exists "Signed-in users can request a banner" on public.banner_ads;
create policy "Signed-in users can request a banner"
  on public.banner_ads for insert
  with check (auth.uid() = submitted_by);

drop policy if exists "Admins can update banner requests" on public.banner_ads;
create policy "Admins can update banner requests"
  on public.banner_ads for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "Admins can delete banner requests" on public.banner_ads;
create policy "Admins can delete banner requests"
  on public.banner_ads for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ---------- direct messages (1:1 DMs between profiles) ----------
create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);

alter table public.direct_messages enable row level security;

drop policy if exists "Users can view their own conversations" on public.direct_messages;
create policy "Users can view their own conversations"
  on public.direct_messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "Users can send messages" on public.direct_messages;
create policy "Users can send messages"
  on public.direct_messages for insert
  with check (
    auth.uid() = sender_id
    and not exists (
      select 1 from public.blocked_users b
      where (b.blocker_id = recipient_id and b.blocked_id = sender_id)
         or (b.blocker_id = sender_id and b.blocked_id = recipient_id)
    )
  );

drop policy if exists "Recipients can mark messages read" on public.direct_messages;
create policy "Recipients can mark messages read"
  on public.direct_messages for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

create index if not exists direct_messages_conversation_idx
  on public.direct_messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at);

-- ---------- dm_reports (direct message moderation) ----------
create table if not exists public.dm_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.direct_messages (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.dm_reports enable row level security;

drop policy if exists "Users can insert their own dm reports" on public.dm_reports;
create policy "Users can insert their own dm reports"
  on public.dm_reports for insert
  with check (auth.uid() = reporter_id);

drop policy if exists "Admins can view dm reports" on public.dm_reports;
create policy "Admins can view dm reports"
  on public.dm_reports for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "Admins can delete dm reports" on public.dm_reports;
create policy "Admins can delete dm reports"
  on public.dm_reports for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ---------- weekly newsletter issues ----------
create table if not exists public.newsletter_issues (
  id uuid primary key default gen_random_uuid(),
  issue_date date not null default current_date,
  status text not null default 'draft' check (status in ('draft', 'published')),
  title text not null default 'This Week on Feedback',
  upcoming_releases text,
  underground_releases text,
  upcoming_artists text,
  upcoming_actors text,
  upcoming_short_films text,
  short_film_releases text,
  artist_of_week text,
  filmmaker_of_week text,
  cover_image_url text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

alter table public.newsletter_issues add column if not exists cover_image_url text;

alter table public.newsletter_issues enable row level security;

drop policy if exists "Published issues are viewable by everyone" on public.newsletter_issues;
create policy "Published issues are viewable by everyone"
  on public.newsletter_issues for select
  using (
    status = 'published'
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

drop policy if exists "Admins can create newsletter issues" on public.newsletter_issues;
create policy "Admins can create newsletter issues"
  on public.newsletter_issues for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "Admins can update newsletter issues" on public.newsletter_issues;
create policy "Admins can update newsletter issues"
  on public.newsletter_issues for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "Admins can delete newsletter issues" on public.newsletter_issues;
create policy "Admins can delete newsletter issues"
  on public.newsletter_issues for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ---------- site pages (admin can archive built-in pages, or add custom ones) ----------
create table if not exists public.site_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  kind text not null default 'custom' check (kind in ('builtin', 'custom')),
  path text not null,
  content text,
  archived boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.site_pages enable row level security;

drop policy if exists "Non-archived pages are viewable by everyone" on public.site_pages;
create policy "Non-archived pages are viewable by everyone"
  on public.site_pages for select
  using (
    not archived
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

drop policy if exists "Admins can create site pages" on public.site_pages;
create policy "Admins can create site pages"
  on public.site_pages for insert
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "Admins can update site pages" on public.site_pages;
create policy "Admins can update site pages"
  on public.site_pages for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "Admins can delete site pages" on public.site_pages;
create policy "Admins can delete site pages"
  on public.site_pages for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ---------- general verified badge, admin stat boosts, custom name color ----------
-- Separate from is_verified_artist (which is specific to the Artists/Creators
-- page) - this is a general "verified" checkmark shown next to a user's name
-- everywhere: profile, post cards, comments, chat. bonus_followers/
-- bonus_likes are admin-set numbers added on top of the real counts, purely
-- cosmetic. name_color lets admin give any profile (typically their own) a
-- custom username color sitewide.
alter table public.profiles add column if not exists is_verified boolean not null default false;
alter table public.profiles add column if not exists bonus_followers integer not null default 0;
alter table public.profiles add column if not exists bonus_likes integer not null default 0;
alter table public.profiles add column if not exists name_color text;

-- ---------- notification read tracking ----------
-- The notification bell computes its list live from likes/comments/follows
-- (no dedicated notifications table), so the unread badge count needs a
-- single timestamp per user marking when they last opened the bell - only
-- items newer than this count toward the badge.
alter table public.profiles add column if not exists notifications_seen_at timestamptz;

-- ---------- pinned posts ----------
alter table public.posts add column if not exists pinned boolean not null default false;

-- ---------- Orby daily use limit ----------
-- Orby calls the Gemini API, which has a rate-limited free-tier quota, so
-- each signed-in user gets a capped number of Orby messages per calendar
-- day. orby_use_date is the day the count applies to; the count resets to 0
-- the first time a user messages Orby on a new day.
alter table public.profiles add column if not exists orby_use_count integer not null default 0;
alter table public.profiles add column if not exists orby_use_date date;

-- ---------- banner ad link is now optional ----------
-- Not every banner submission (e.g. a one-off event flyer) has a link to
-- send people to.
alter table public.banner_ads alter column link_url drop not null;

-- ---------- banner ad slot type (submitter picks the shape) ----------
-- Banners used to be pooled and rotated across all three ad shapes
-- (sidebar square, in-feed wide, homepage feature) regardless of what
-- aspect ratio the uploaded image actually was - stretching one crop into
-- three very different boxes. Now the submitter picks which shape they're
-- uploading for and crops to match, and each placement only rotates
-- through banners submitted for that specific shape.
alter table public.banner_ads add column if not exists slot_type text not null default 'sidebar'
  check (slot_type in ('sidebar', 'wide', 'feature'));

-- ---------- homepage section toggles ----------
-- Lets an admin show/hide individual homepage sections (Artist Spotlight
-- ads, Wrapped promo, Clubs teaser, etc.) from the admin panel instead of
-- needing a code change every time - one row per section, missing rows
-- fall back to each flag's coded default (see src/lib/siteFlags.ts).
create table if not exists public.site_flags (
  key text primary key,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.site_flags enable row level security;

drop policy if exists "Site flags are viewable by everyone" on public.site_flags;
create policy "Site flags are viewable by everyone"
  on public.site_flags for select
  using (true);

drop policy if exists "Admins can change site flags" on public.site_flags;
create policy "Admins can change site flags"
  on public.site_flags for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ---------- newsletter issue photo strip ----------
-- cover_image_url is the one hero image; image_urls holds a few more real
-- cover/poster images pulled from the same data used to draft the issue,
-- so the email reads like an actual illustrated newsletter instead of a
-- wall of text with a single picture at the top.
alter table public.newsletter_issues add column if not exists image_urls text[] not null default '{}';

-- ---------- big hero ad slot ----------
-- Adds a fourth, much larger ad shape (970x250) alongside the existing
-- sidebar/wide/feature ones - re-creates the check constraint since
-- "add column if not exists" is a no-op (constraint included) once the
-- column already exists from an earlier run of this file.
alter table public.banner_ads drop constraint if exists banner_ads_slot_type_check;
alter table public.banner_ads add constraint banner_ads_slot_type_check
  check (slot_type in ('hero', 'sidebar', 'wide', 'feature'));


-- ---------- newsletter_subscribers ----------
-- Everyone who should receive The Feedback Weekly. Account holders are
-- added here automatically at signup (see signUp in app/actions/auth.ts);
-- waitlist_signups stays separate since that's the pre-account "get
-- notified" capture. unsubscribed_at is set instead of deleting the row so
-- a re-signup can't silently resubscribe someone who opted out.
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid references public.profiles (id) on delete set null,
  source text not null default 'signup',
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists newsletter_subscribers_email_lower_idx
  on public.newsletter_subscribers (lower(email));

alter table public.newsletter_subscribers enable row level security;

drop policy if exists "Anyone can subscribe to the newsletter" on public.newsletter_subscribers;
create policy "Anyone can subscribe to the newsletter"
  on public.newsletter_subscribers for insert
  with check (true);

drop policy if exists "Admins can view newsletter subscribers" on public.newsletter_subscribers;
create policy "Admins can view newsletter subscribers"
  on public.newsletter_subscribers for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ---------- AI bot accounts ----------
-- Personas that post reviews, chat, and like posts so the site isn't empty
-- while the real community is still small. They're real rows in profiles
-- (so leaderboard, feed and chat need no special-casing) but flagged, so
-- the UI can label them and sends can exclude them.
alter table public.profiles add column if not exists is_bot boolean not null default false;
alter table public.profiles add column if not exists bot_persona text;
alter table public.profiles add column if not exists bot_active boolean not null default true;

create index if not exists profiles_is_bot_idx on public.profiles (is_bot) where is_bot;

-- ---------- Admin-editable theme tokens ----------
-- Overrides for the CSS custom properties a theme is built from. Stored per
-- (theme, token) so an admin can retune one value without owning the whole
-- theme, and so resetting is just deleting rows. Applied as inline custom
-- properties on <html>, which outranks every [data-theme] block in the
-- stylesheet without the app having to generate CSS text.
create table if not exists public.site_theme_tokens (
  theme text not null,
  token text not null,
  value text not null,
  updated_at timestamptz not null default now(),
  primary key (theme, token)
);

alter table public.site_theme_tokens enable row level security;

drop policy if exists "Theme tokens are viewable by everyone" on public.site_theme_tokens;
create policy "Theme tokens are viewable by everyone"
  on public.site_theme_tokens for select
  using (true);

drop policy if exists "Admins can change theme tokens" on public.site_theme_tokens;
create policy "Admins can change theme tokens"
  on public.site_theme_tokens for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ---------- Site-wide settings ----------
-- Small key/value store for single site-wide choices that aren't booleans
-- (site_flags) and aren't editable copy (site_content). Currently the
-- site-wide theme and whether it's forced on everyone or just the default.
create table if not exists public.site_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

drop policy if exists "Site settings are viewable by everyone" on public.site_settings;
create policy "Site settings are viewable by everyone"
  on public.site_settings for select
  using (true);

drop policy if exists "Admins can change site settings" on public.site_settings;
create policy "Admins can change site settings"
  on public.site_settings for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ---------- Photography as a third review type ----------
-- Reviews only. Clubs (clubs.media_type) and the currently-listening
-- status (profiles.status_media_type) keep their two-value constraints
-- on purpose - a photography club and a "currently viewing" status
-- weren't part of this, and widening them would let the UI offer
-- options the rest of the app doesn't handle.
alter table public.posts drop constraint if exists posts_media_type_check;
alter table public.posts add constraint posts_media_type_check
  check (media_type in ('music', 'movie_tv', 'photography'));

-- ---------- Custom background: fill mode + mirror ----------
-- How the member's uploaded background sits on the page. Nullable with a
-- default so every existing custom background keeps the cover behaviour
-- it already had.
alter table public.profiles add column if not exists background_fit text
  not null default 'cover'
  check (background_fit in ('cover', 'contain', 'tile'));
alter table public.profiles add column if not exists background_flipped boolean
  not null default false;
