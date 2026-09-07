-- Run this once in the Supabase SQL editor.
--
-- A shared memory for cover art.
--
-- Apple's catalogue is free and keyless and allows roughly twenty calls
-- a minute across everything this site does. That budget was being spent
-- looking up the same records over and over: every shelf view, for every
-- visitor, asked again for covers somebody had already fetched an hour
-- earlier. Which is why the search box in the post form kept being told
-- the catalogue was busy - it was busy with us.
--
-- Asking once, for everybody, forever is the fix. A record's artwork
-- does not change, so there is no reason this is not simply written
-- down. After the first person sees a record, every shelf that shows it
-- again is a database read.
--
-- Safe to run more than once.

create table if not exists public.track_covers (
  -- The same key the rest of the site uses for a work: title and artist
  -- squashed, so "Jay-Z" and "Jay Z" land on one row.
  work_key text primary key,
  artwork_url text,
  preview_url text,
  track_url text,
  release_year int,
  -- Kept so a row can be refreshed one day if it needs to be. Nothing
  -- reads it yet, and a cover really does not change.
  updated_at timestamptz not null default now()
);

-- A row saying "we looked and Apple has nothing" is as valuable as one
-- with a picture in it: it stops the next fifty page views asking again
-- about a record that is not in the catalogue. So every column above is
-- nullable on purpose, and the presence of the ROW is the fact.

alter table public.track_covers enable row level security;

-- Readable by anyone, because covers appear on pages anyone can see.
drop policy if exists "Track covers are viewable by everyone" on public.track_covers;
create policy "Track covers are viewable by everyone"
  on public.track_covers for select
  using (true);

-- No insert or update policy on purpose. Writes come from the server
-- through the service-role client, which bypasses RLS - so nobody can
-- point a record at a picture of their own choosing by calling the API
-- directly. A shared cache that any signed-in person could write to is a
-- shared cache that one person can vandalise for everybody.
