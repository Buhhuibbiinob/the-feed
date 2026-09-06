-- Run this once in the Supabase SQL editor, same as the others.
--
-- Playlists people already made somewhere else.
--
-- Nobody is going to rebuild their playlists here, and asking them to
-- would be the wrong thing to want. The value is that a playlist
-- somebody has actually been living with for a year can be put in front
-- of the other twelve people, in one paste.
--
-- Safe to run more than once.

-- ---------- playlists ----------
create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null check (provider in ('spotify', 'apple')),
  -- The provider's own id: a Spotify base-62 string, or an Apple "pl."
  -- hash. Everything the embed needs except Apple's storefront.
  provider_id text not null,
  -- Apple's embed will not load from the wrong storefront, so the
  -- country the link came from is part of the address rather than a
  -- detail. Null for Spotify, which has no such thing.
  storefront text,
  slug text,
  -- What its owner calls it. Typed rather than fetched: reading the real
  -- name needs an API token on both services, and a playlist called
  -- "the one for the drive home" says more than the official name does.
  title text not null,
  note text,
  created_at timestamptz not null default now()
);

-- One person cannot add the same playlist twice. Adding it again is
-- forgetting, so the action treats the collision as success rather than
-- telling somebody off.
create unique index if not exists playlists_unique_idx
  on public.playlists (user_id, provider, provider_id);

create index if not exists playlists_recent_idx
  on public.playlists (created_at desc);

alter table public.playlists enable row level security;

-- Public to read, like everything else here. A playlist added to a
-- shared music tab is being shown to the room by definition - the
-- private thing on this site is the queue, and that is deliberate.
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

-- Owners remove their own. Admins remove anybody's, through the
-- service-role client, the same way they remove a post - moderation
-- has to reach everything that is publicly visible.
drop policy if exists "Users can remove their own playlists" on public.playlists;
create policy "Users can remove their own playlists"
  on public.playlists for delete
  using (auth.uid() = user_id);
