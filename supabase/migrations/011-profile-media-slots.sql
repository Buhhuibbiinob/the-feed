-- Run this once in the Supabase SQL editor, same as the others.
--
-- The six boxes on a profile - three banners across the top, three
-- tiles along the bottom - become the member's to fill.
--
-- Until now they were reviews chosen by a rule. A rule is a reasonable
-- default and a poor ceiling: the whole point of a shopfront is that
-- somebody decided what goes in the window. Each slot can hold a picture
-- or a music video that plays, and a slot nobody has filled falls back
-- to the review that was there before, so nothing empties out.
--
-- Safe to run more than once.

create table if not exists public.profile_media_slots (
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- 0,1,2 across the top; 3,4,5 along the bottom. Fixed positions rather
  -- than an ordered list, because these are six holes in a layout, not a
  -- collection that grows.
  slot smallint not null check (slot between 0 and 5),
  kind text not null check (kind in ('image', 'video')),
  image_url text,
  youtube_id text,
  title text,
  subtitle text,
  link_url text,
  updated_at timestamptz not null default now(),
  primary key (user_id, slot),
  -- A slot has to actually contain the thing it says it contains,
  -- checked here rather than only in the form: a video row with no video
  -- renders as a black rectangle, and that is the kind of empty that
  -- looks like a bug rather than like a blank.
  constraint profile_media_slots_has_content check (
    (kind = 'image' and image_url is not null)
    or (kind = 'video' and youtube_id is not null)
  )
);

alter table public.profile_media_slots enable row level security;

-- Readable by everyone: these are the front of somebody's public page.
drop policy if exists "Profile media is viewable by everyone" on public.profile_media_slots;
create policy "Profile media is viewable by everyone"
  on public.profile_media_slots for select
  using (true);

drop policy if exists "Members fill their own slots" on public.profile_media_slots;
create policy "Members fill their own slots"
  on public.profile_media_slots for insert
  with check (auth.uid() = user_id);

drop policy if exists "Members change their own slots" on public.profile_media_slots;
create policy "Members change their own slots"
  on public.profile_media_slots for update
  using (auth.uid() = user_id);

drop policy if exists "Members clear their own slots" on public.profile_media_slots;
create policy "Members clear their own slots"
  on public.profile_media_slots for delete
  using (auth.uid() = user_id);
