-- Run this once in the Supabase SQL editor, same as the others.
--
-- Handing somebody a record.
--
-- Every other way to find music here is a machine: the rails walk a
-- similarity graph, the Crate shuffles, the Shelves sort by tag. This is
-- the one that is a person - you pick one record, one member, and say
-- why. On a site with thirteen people that is by far the strongest
-- signal available, and it was the only one with nowhere to go.
--
-- Safe to run more than once.

-- ---------- handoffs ----------
create table if not exists public.handoffs (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles (id) on delete cascade,
  to_user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  -- Optional, but the whole point. A record handed over with nothing
  -- said is a link; a record handed over with "this is the one I kept
  -- talking about" is a recommendation.
  note text,
  created_at timestamptz not null default now(),
  -- Stops the alert repeating. Not a read receipt for the sender: it is
  -- never shown to them, because "they saw it and said nothing" is a
  -- thing nobody needs to be told about a friend.
  seen_at timestamptz,
  -- What they did with it. The only column here worth counting later:
  -- how often a member's handoffs get taken is the closest thing this
  -- site has to knowing whose taste to trust.
  kept_at timestamptz,
  -- Handing a record to yourself is not a thing that happens in a shop.
  constraint handoffs_not_self check (from_user_id <> to_user_id)
);

-- One person can hand one record to one other person once. Handing the
-- same record again is not a second recommendation, it is nagging - and
-- the unique index means the action can treat the repeat as success
-- rather than telling somebody off for forgetting.
create unique index if not exists handoffs_unique_idx
  on public.handoffs (from_user_id, to_user_id, post_id);

-- The inbox query: everything handed to me, newest first.
create index if not exists handoffs_to_user_idx
  on public.handoffs (to_user_id, created_at desc);

alter table public.handoffs enable row level security;

-- Visible to the two people involved and nobody else. A handoff is a
-- private thing said to one person - it is closer to a note passed
-- across a table than to a post - so it is not public even though almost
-- everything else on this site is.
drop policy if exists "Handoffs are visible to sender and recipient" on public.handoffs;
create policy "Handoffs are visible to sender and recipient"
  on public.handoffs for select
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);

drop policy if exists "Users can hand over their own recommendations" on public.handoffs;
create policy "Users can hand over their own recommendations"
  on public.handoffs for insert
  with check (auth.uid() = from_user_id);

-- Only the recipient marks it seen or kept: those two columns are about
-- what THEY did, and letting the sender write them would make a
-- "3 people kept this" count something a sender could manufacture.
drop policy if exists "Recipients can mark a handoff seen or kept" on public.handoffs;
create policy "Recipients can mark a handoff seen or kept"
  on public.handoffs for update
  using (auth.uid() = to_user_id)
  with check (auth.uid() = to_user_id);

-- Either side can take it back: the sender because handing something
-- over is not irreversible, the recipient because an inbox you cannot
-- clear is not an inbox.
drop policy if exists "Either side can remove a handoff" on public.handoffs;
create policy "Either side can remove a handoff"
  on public.handoffs for delete
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);
