-- Run this once in the Supabase SQL editor, same as 001 and 002.
--
-- Adds duets: a review that answers another review. One nullable column
-- and one partial index. Safe to run more than once.

-- ---------- Duets: a review that answers another review ----------
-- Call and response instead of isolated reviews.
--
-- A nullable self-reference rather than its own table: a duet IS a post -
-- same body, same rating, same likes and reactions and comments - that
-- happens to point at the one it answers. A separate table would have
-- meant every feed query unioning two shapes for no gain.
--
-- ON DELETE SET NULL, not CASCADE. Deleting your review must not delete
-- everyone else's answers to it; they stand on their own as reviews, and
-- taking down four other people's posts by removing yours would be a
-- moderation hole as much as a data one.
alter table public.posts
  add column if not exists responds_to_post_id uuid references public.posts (id) on delete set null;

create index if not exists posts_responds_to_idx
  on public.posts (responds_to_post_id)
  where responds_to_post_id is not null;
