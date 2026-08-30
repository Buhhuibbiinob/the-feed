-- Run this once in the Supabase SQL editor, same as the others.
--
-- The thing being reviewed, as a row. Safe to run more than once.

-- ---------- works ----------
-- Until now there was no such object. A review of Dune was free text, and
-- two people reviewing Dune produced two unrelated rows; the feed papered
-- over it by lower-casing titles in memory, which merged a film called
-- Blue with a song called Blue and split every song called Alright by
-- nobody in particular.
--
-- work_key is the normalised identity, built in src/lib/works.ts and
-- deliberately built ONLY there: a second implementation in SQL that
-- disagreed with the first by one character would quietly file reviews
-- under two different works. That is also why the backfill is an endpoint
-- rather than an UPDATE in this file.
create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  work_key text not null,
  media_type text not null check (media_type in ('music', 'movie_tv', 'photography')),
  title text not null,
  artist text,
  cover_url text,
  created_at timestamptz not null default now()
);

-- The identity itself. Unique, because two rows with the same key are two
-- pages for one thing, which is the bug this table exists to prevent.
create unique index if not exists works_key_idx on public.works (work_key);

alter table public.works enable row level security;

-- Readable by everyone, like the reviews on it. Nobody writes one
-- directly: they come into existence through posting, the same way clubs
-- do, so there is no insert policy for members and the server writes
-- them through the same session that writes the post.
drop policy if exists "Works are viewable by everyone" on public.works;
create policy "Works are viewable by everyone"
  on public.works for select
  using (true);

drop policy if exists "Signed-in members create works by posting" on public.works;
create policy "Signed-in members create works by posting"
  on public.works for insert
  with check (auth.uid() is not null);

-- Only ever to fill in artwork that was missing.
drop policy if exists "Signed-in members can fill in a work" on public.works;
create policy "Signed-in members can fill in a work"
  on public.works for update
  using (auth.uid() is not null);

-- ---------- posts.work_id ----------
-- Nullable, and it stays nullable: every review posted before today has
-- no work until the backfill runs, and a review whose title is only
-- punctuation has no work at all.
alter table public.posts add column if not exists work_id uuid references public.works (id) on delete set null;
create index if not exists posts_work_idx on public.posts (work_id);
