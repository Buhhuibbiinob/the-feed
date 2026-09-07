-- OPTIONAL. Read this one before running it: it changes what other
-- people can see, and that is not a change you can take back quietly.
--
-- Letting visitors see somebody's shelf.
--
-- Playlists are already readable by everyone, so a playlist shelf works
-- on anybody's profile for anybody looking at it. Queue rows are not:
-- migration 006 made them readable by their owner alone, on purpose,
-- with the note that "opening it later is one policy change while
-- un-exposing something people assumed was private is not".
--
-- This is that one policy change. After it, the shelf section on a
-- profile shows the member's shelf to anyone who visits, the same way
-- their reviews and collections already do. Before it, that section
-- appears on the owner's own profile and nowhere else - which is what
-- the site does today, and is a perfectly reasonable place to stop.
--
-- What becomes visible: the title, the artist, the cover and whether it
-- came from somebody else's review, for anything a member has put aside
-- and not yet marked as played. Nothing about ratings, nothing private,
-- nothing they did not already choose to put on a shelf.
--
-- What does NOT change: only the owner can add to a shelf, take
-- something off it, or mark it played. Those policies are untouched.
--
-- If members joined believing their watchlist was private, tell them
-- before running this rather than after.
--
-- Safe to run more than once. To undo it, run the block at the bottom.

drop policy if exists "Queue items are viewable by their owner" on public.queue_items;
drop policy if exists "Queue items are viewable by everyone" on public.queue_items;
create policy "Queue items are viewable by everyone"
  on public.queue_items for select
  using (true);

-- ---------- to put it back ----------
--
-- drop policy if exists "Queue items are viewable by everyone" on public.queue_items;
-- create policy "Queue items are viewable by their owner"
--   on public.queue_items for select
--   using (auth.uid() = user_id);
--
-- Worth knowing: putting it back hides the shelves again from that
-- moment on, but it cannot un-see anything anybody already looked at.
