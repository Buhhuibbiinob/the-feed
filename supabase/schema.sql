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

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Admins can upload club assets" on storage.objects;
create policy "Admins can upload club assets"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = 'club-assets'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "Admins can update club assets" on storage.objects;
create policy "Admins can update club assets"
  on storage.objects for update
  using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = 'club-assets'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

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

-- Widen the club-assets storage policies (originally admin-only, defined
-- earlier in this file before public.clubs existed) so a club's own creator
-- can upload its banner/avatar too, not just site admins. Path shape is
-- club-assets/<club_id>/<file>, so foldername()[2] is the club id.
drop policy if exists "Admins can upload club assets" on storage.objects;
drop policy if exists "Admins and club owners can upload club assets" on storage.objects;
create policy "Admins and club owners can upload club assets"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = 'club-assets'
    and (
      exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
      or exists (
        select 1 from public.clubs
        where id::text = (storage.foldername(name))[2] and created_by = auth.uid()
      )
    )
  );

drop policy if exists "Admins can update club assets" on storage.objects;
drop policy if exists "Admins and club owners can update club assets" on storage.objects;
create policy "Admins and club owners can update club assets"
  on storage.objects for update
  using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = 'club-assets'
    and (
      exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
      or exists (
        select 1 from public.clubs
        where id::text = (storage.foldername(name))[2] and created_by = auth.uid()
      )
    )
  );

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
