-- Run this once in the Supabase SQL editor, same as the others.
--
-- "Up Next": the things you mean to watch or listen to but haven't yet.
-- Safe to run more than once.

-- ---------- queue_items ----------
-- Distinct from collections, which are public lists of REVIEWS other
-- people wrote. This is a list of THINGS, most of which nobody here has
-- reviewed yet - the point is that it exists before the review does.
--
-- done_at rather than deleting the row: ticking something off is the end
-- of a small story ("I said I'd watch this, I watched it"), and throwing
-- the row away means the site can never say so.
create table if not exists public.queue_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  media_type text not null check (media_type in ('music', 'movie_tv', 'photography')),
  title text not null,
  subtitle text,
  image_url text,
  -- The review that made them add it, when there was one. Set null on
  -- delete rather than cascading: if that review goes, the intention to
  -- watch the thing doesn't.
  from_post_id uuid references public.posts (id) on delete set null,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

-- One entry per thing per person. Lower(title) so "Dune" and "dune"
-- aren't two rows in a list you have to read with your eyes.
create unique index if not exists queue_items_unique_idx
  on public.queue_items (user_id, media_type, lower(title));

create index if not exists queue_items_user_idx
  on public.queue_items (user_id, done_at, created_at desc);

alter table public.queue_items enable row level security;

-- Private for now, deliberately. Everything else on this site is public
-- by default and this could be too - "3 people have this queued" is a
-- good signal - but nothing displays anybody else's list yet, and
-- opening it later is one policy change while un-exposing something
-- people assumed was private is not.
drop policy if exists "Queue items are viewable by their owner" on public.queue_items;
create policy "Queue items are viewable by their owner"
  on public.queue_items for select
  using (auth.uid() = user_id);

drop policy if exists "Users can add their own queue items" on public.queue_items;
create policy "Users can add their own queue items"
  on public.queue_items for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own queue items" on public.queue_items;
create policy "Users can update their own queue items"
  on public.queue_items for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own queue items" on public.queue_items;
create policy "Users can delete their own queue items"
  on public.queue_items for delete
  using (auth.uid() = user_id);
