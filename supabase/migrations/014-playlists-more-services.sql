-- Run this once in the Supabase SQL editor.
--
-- More services, and a cover for each playlist.
--
-- This file is self-sufficient on purpose: it creates the playlists
-- table if it is not there, so it can be run on its own whether or not
-- 013 was ever applied. Running 013 first is harmless either way.
--
-- Safe to run more than once.

-- ---------- the table, if 013 never ran ----------
create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null,
  provider_id text not null,
  storefront text,
  slug text,
  title text not null,
  note text,
  created_at timestamptz not null default now()
);

-- ---------- more services ----------
-- 013 pinned the provider list to Spotify and Apple in a check
-- constraint. Six now: both of those, plus YouTube, SoundCloud, Deezer
-- and Tidal. Every one of them will embed a public playlist for anybody
-- with the link and no account, which is the only test that matters
-- here - a service that needs a login to play is a service that shows
-- most people a sign-in wall where a playlist should be.
alter table public.playlists drop constraint if exists playlists_provider_check;
alter table public.playlists
  add constraint playlists_provider_check
  check (provider in ('spotify', 'apple', 'youtube', 'soundcloud', 'deezer', 'tidal'));

-- ---------- the cover ----------
-- Cover Flow is covers, and a wall of grey rectangles with titles under
-- them is a list. Fetched once when the playlist is added - from the
-- service's own oEmbed endpoint where there is one, from the page's
-- og:image where there is not - and kept here, because a playlist's
-- artwork does not change and re-fetching it on every render would be
-- twelve requests every time anybody opened the tab.
alter table public.playlists add column if not exists cover_url text;

-- ---------- indexes and policies (no-ops if 013 ran) ----------
create unique index if not exists playlists_unique_idx
  on public.playlists (user_id, provider, provider_id);

create index if not exists playlists_recent_idx
  on public.playlists (created_at desc);

alter table public.playlists enable row level security;

drop policy if exists "Playlists are viewable by everyone" on public.playlists;
create policy "Playlists are viewable by everyone"
  on public.playlists for select
  using (true);

drop policy if exists "Users can add their own playlists" on public.playlists;
create policy "Users can add their own playlists"
  on public.playlists for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can edit their own playlists" on public.playlists;
create policy "Users can edit their own playlists"
  on public.playlists for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own playlists" on public.playlists;
create policy "Users can remove their own playlists"
  on public.playlists for delete
  using (auth.uid() = user_id);
