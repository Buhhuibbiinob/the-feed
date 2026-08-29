-- Run this once in the Supabase SQL editor.
--
-- Everything here is already in supabase/schema.sql; this file is only the
-- part your database has not had applied yet. Same SQL, lifted out so you
-- do not have to re-run the whole file to get four changes.
--
-- Safe to run more than once: every statement is create-if-not-exists or
-- drop-then-create.
--
-- Fixes: "Could not find the table 'public.weekly_answers' in the schema
-- cache" on /weekly, reactions on reviews silently doing nothing, and
-- photography clubs and statuses being rejected.


-- ============================================================
-- 1. Photography as a first-class category
-- ------------------------------------------------------------
-- Clubs and the currently-listening status were locked to music and film.
-- Without this, creating a photography club fails and so does setting a
-- "Looking at" status.
-- ============================================================

alter table public.clubs drop constraint if exists clubs_media_type_check;
alter table public.clubs add constraint clubs_media_type_check
  check (media_type in ('music', 'movie_tv', 'photography'));

alter table public.profiles drop constraint if exists profiles_status_media_type_check;
alter table public.profiles add constraint profiles_status_media_type_check
  check (status_media_type in ('music', 'movie_tv', 'photography'));


-- ============================================================
-- 2. The weekly question
-- ============================================================

-- ---------- weekly_answers ----------
-- One question a week, the same for everybody, with all the answers on one
-- page.
--
-- The question itself is NOT stored here: lib/weeklyPrompt.ts derives it
-- from the week arithmetically, so the rotation runs for ever with no
-- scheduled job and no admin filling a table in. What is stored is what
-- people said. prompt_id is kept anyway so an answer still makes sense if
-- the prompt list is ever reordered.
create table if not exists public.weekly_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- The Monday of the week, in UTC. Text rather than date so it matches
  -- the YYYY-MM-DD the app computes, with no timezone conversion in
  -- between to move an answer into the wrong week.
  week_start text not null,
  prompt_id text not null,
  title text not null,
  subtitle text,
  note text,
  created_at timestamptz not null default now(),
  -- One answer each per week. Changing your mind edits it rather than
  -- adding a second.
  unique (user_id, week_start)
);

create index if not exists weekly_answers_week_idx
  on public.weekly_answers (week_start, created_at desc);

alter table public.weekly_answers enable row level security;

drop policy if exists "Weekly answers are viewable by everyone" on public.weekly_answers;
create policy "Weekly answers are viewable by everyone"
  on public.weekly_answers for select
  using (true);

drop policy if exists "Members can answer for themselves" on public.weekly_answers;
create policy "Members can answer for themselves"
  on public.weekly_answers for insert
  with check (auth.uid() = user_id);

drop policy if exists "Members can edit their own answer" on public.weekly_answers;
create policy "Members can edit their own answer"
  on public.weekly_answers for update
  using (auth.uid() = user_id);

drop policy if exists "Members and admins can delete an answer" on public.weekly_answers;
create policy "Members and admins can delete an answer"
  on public.weekly_answers for delete
  using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );


-- ============================================================
-- 3. Reactions on reviews
-- ============================================================

-- ---------- post_reactions ----------
-- Reaction tags on reviews, alongside the star rating rather than instead
-- of it. A star says how good it was; these say what it did to you, and
-- they're quick enough to leave that people actually do.
create table if not exists public.post_reactions (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_reactions_post_idx on public.post_reactions (post_id);

alter table public.post_reactions enable row level security;

drop policy if exists "Post reactions are viewable by everyone" on public.post_reactions;
create policy "Post reactions are viewable by everyone"
  on public.post_reactions for select
  using (true);

drop policy if exists "Members can react to posts as themselves" on public.post_reactions;
create policy "Members can react to posts as themselves"
  on public.post_reactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Members can change their own post reaction" on public.post_reactions;
create policy "Members can change their own post reaction"
  on public.post_reactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Members can remove their own post reaction" on public.post_reactions;
create policy "Members can remove their own post reaction"
  on public.post_reactions for delete
  using (auth.uid() = user_id);
