-- Run this once in the Supabase SQL editor.
--
-- Filing a member's own music somewhere.
--
-- artist_posts is where somebody puts up music they made themselves,
-- and it had no genre on it. So it could appear in one place - the
-- Artists page, newest first - and nowhere else. It could not be on a
-- shelf, because a shelf is a genre and there was nothing to match on.
--
-- Which means the site walked past its own reason for existing. A wall
-- of UK R&B built entirely out of a catalogue, with a member's own UK
-- R&B record sitting on another page unable to get on it, is the wrong
-- way round for a site about what the people here are actually making.
--
-- One nullable column. Nullable on purpose: everything already posted
-- stays exactly as it is and appears exactly where it did, and nobody
-- is made to categorise a record they put up months ago.
--
-- Safe to run more than once.

alter table public.artist_posts add column if not exists genre text;

-- The shelf query: everything of one genre, newest first.
create index if not exists artist_posts_genre_idx
  on public.artist_posts (genre, created_at desc)
  where genre is not null;
