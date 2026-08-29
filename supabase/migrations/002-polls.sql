-- Run this once in the Supabase SQL editor, same as 001.
--
-- Adds Matchups: two-option polls and their votes. Safe to run more than
-- once - every statement is create-if-not-exists or drop-then-create.

-- ---------- polls + poll_votes ----------
-- Two-option matchups: "which one's better". The lowest-effort thing on
-- the site - voting is one tap and needs no writing at all - and the most
-- shareable, because the result only means something once people disagree.
--
-- Deliberately two options and no more. Three-way polls turn into a
-- survey; two is an argument, which is the thing people actually want to
-- have about music and film.
create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  media_type text not null check (media_type in ('music', 'movie_tv', 'photography')),
  question text,
  option_a text not null,
  option_b text not null,
  -- The small line under each option: the artist, the director, the year.
  subtitle_a text,
  subtitle_b text,
  created_at timestamptz not null default now()
);

create index if not exists polls_recent_idx on public.polls (created_at desc);

create table if not exists public.poll_votes (
  poll_id uuid not null references public.polls (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- 'a' or 'b'. Changeable: seeing the split is half the fun and people
  -- move once they have seen it.
  choice text not null check (choice in ('a', 'b')),
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create index if not exists poll_votes_poll_idx on public.poll_votes (poll_id);

alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;

drop policy if exists "Polls are viewable by everyone" on public.polls;
create policy "Polls are viewable by everyone"
  on public.polls for select
  using (true);

drop policy if exists "Members can create polls" on public.polls;
create policy "Members can create polls"
  on public.polls for insert
  with check (auth.uid() = created_by);

drop policy if exists "Authors and admins can delete a poll" on public.polls;
create policy "Authors and admins can delete a poll"
  on public.polls for delete
  using (
    auth.uid() = created_by
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

drop policy if exists "Poll votes are viewable by everyone" on public.poll_votes;
create policy "Poll votes are viewable by everyone"
  on public.poll_votes for select
  using (true);

drop policy if exists "Members can vote as themselves" on public.poll_votes;
create policy "Members can vote as themselves"
  on public.poll_votes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Members can change their own vote" on public.poll_votes;
create policy "Members can change their own vote"
  on public.poll_votes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Members can take back their own vote" on public.poll_votes;
create policy "Members can take back their own vote"
  on public.poll_votes for delete
  using (auth.uid() = user_id);
