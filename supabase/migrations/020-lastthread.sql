-- LastThread: accounts, profiles and posts.
--
-- LastThread is the static site under public/lastthread. Until now everything
-- it saved lived in one browser's localStorage, which means an entry written
-- on a laptop did not exist on a phone and nobody else could read it. This
-- migration gives it three tables so a person can sign in and have the site
-- follow them, and so a post is published rather than kept.
--
-- It uses Supabase's own auth.users for accounts, the same as the rest of this
-- project. Nothing here touches any existing table, and no existing policy is
-- changed. The feed at mythefeed.com is unaffected either way.
--
-- What becomes public: posts whose author set them to published, and the
-- name, handle, picture and subgenres on a profile. That is the point of the
-- site, but say it plainly before anybody writes anything: a published post is
-- readable by the whole internet, signed in or not.
--
-- What stays private: drafts, and anything in a browser that was never synced.
--
-- Safe to run more than once. The undo block is at the bottom.

-- ---------- profiles ----------

create table if not exists public.lastthread_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  handle      text unique,
  name        text,
  bio         text,
  avatar_url  text,
  subgenres   text[] default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.lastthread_profiles enable row level security;

drop policy if exists "LastThread profiles are viewable by everyone" on public.lastthread_profiles;
create policy "LastThread profiles are viewable by everyone"
  on public.lastthread_profiles for select
  using (true);

drop policy if exists "You can create your own LastThread profile" on public.lastthread_profiles;
create policy "You can create your own LastThread profile"
  on public.lastthread_profiles for insert
  with check (auth.uid() = id);

drop policy if exists "You can edit your own LastThread profile" on public.lastthread_profiles;
create policy "You can edit your own LastThread profile"
  on public.lastthread_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------- posts ----------

create table if not exists public.lastthread_posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  body        text,
  sources     text,
  era         text,
  place       text,
  channel     text,
  picture_url text,
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists lastthread_posts_created_idx on public.lastthread_posts (created_at desc);
create index if not exists lastthread_posts_author_idx  on public.lastthread_posts (author_id);

alter table public.lastthread_posts enable row level security;

-- published posts are the site; drafts belong to their author alone
drop policy if exists "Published LastThread posts are viewable by everyone" on public.lastthread_posts;
create policy "Published LastThread posts are viewable by everyone"
  on public.lastthread_posts for select
  using (published or auth.uid() = author_id);

drop policy if exists "You can write your own LastThread posts" on public.lastthread_posts;
create policy "You can write your own LastThread posts"
  on public.lastthread_posts for insert
  with check (auth.uid() = author_id);

drop policy if exists "You can edit your own LastThread posts" on public.lastthread_posts;
create policy "You can edit your own LastThread posts"
  on public.lastthread_posts for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "You can delete your own LastThread posts" on public.lastthread_posts;
create policy "You can delete your own LastThread posts"
  on public.lastthread_posts for delete
  using (auth.uid() = author_id);

-- ---------- page edits ----------
--
-- The edit bar saves text and pictures against a page and an element address.
-- Held here, an edit made on one machine shows on every machine, for everybody.
-- Only site owners can write them, which is what the owners table decides.

create table if not exists public.lastthread_owners (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  added_at   timestamptz not null default now()
);

alter table public.lastthread_owners enable row level security;

drop policy if exists "Owners are viewable by everyone" on public.lastthread_owners;
create policy "Owners are viewable by everyone"
  on public.lastthread_owners for select
  using (true);
-- deliberately no insert or update policy: add the first owner by hand, in the
-- SQL editor, with the line at the foot of this file.

create table if not exists public.lastthread_edits (
  page       text not null,
  address    text not null,
  kind       text not null check (kind in ('text', 'image')),
  value      text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (page, address, kind)
);

alter table public.lastthread_edits enable row level security;

drop policy if exists "LastThread edits are viewable by everyone" on public.lastthread_edits;
create policy "LastThread edits are viewable by everyone"
  on public.lastthread_edits for select
  using (true);

drop policy if exists "Owners can save LastThread edits" on public.lastthread_edits;
create policy "Owners can save LastThread edits"
  on public.lastthread_edits for insert
  with check (exists (select 1 from public.lastthread_owners o where o.user_id = auth.uid()));

drop policy if exists "Owners can change LastThread edits" on public.lastthread_edits;
create policy "Owners can change LastThread edits"
  on public.lastthread_edits for update
  using (exists (select 1 from public.lastthread_owners o where o.user_id = auth.uid()));

drop policy if exists "Owners can remove LastThread edits" on public.lastthread_edits;
create policy "Owners can remove LastThread edits"
  on public.lastthread_edits for delete
  using (exists (select 1 from public.lastthread_owners o where o.user_id = auth.uid()));

-- ---------- after running this ----------
--
-- 1. Sign up on the site once, with your own email.
-- 2. Come back here and make yourself the owner, so the edit bar can save
--    for everybody rather than only for your browser:
--
--    insert into public.lastthread_owners (user_id)
--    select id from auth.users where email = 'you@example.com'
--    on conflict do nothing;
--
-- ---------- to undo all of it ----------
--
-- drop table if exists public.lastthread_edits;
-- drop table if exists public.lastthread_owners;
-- drop table if exists public.lastthread_posts;
-- drop table if exists public.lastthread_profiles;
