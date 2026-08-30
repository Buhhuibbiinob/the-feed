-- Run this once in the Supabase SQL editor, same as the others.
--
-- One column: what genre a review is about. Safe to run more than once.

-- ---------- posts.genre ----------
-- Until now a post carried three possible descriptions of what it was
-- about: music, movie_tv, photography. "You like movies" is not a taste,
-- which is why Discover can only match on category, clubs cannot cluster,
-- badges have nothing to award, and Wrapped can only count.
--
-- Nullable, and it stays nullable. Every review posted before today has
-- no genre and that is not an error state; making it required would also
-- put a mandatory field in front of the one action this site needs people
-- to take. Values are checked against the app's own list at write time
-- (src/lib/genres.ts) rather than by a constraint here, so adding a genre
-- is a deploy rather than a migration.
alter table public.posts add column if not exists genre text;

-- Filtering the feed by genre is the payoff that makes anybody fill it in.
create index if not exists posts_genre_idx on public.posts (genre);
