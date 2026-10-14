-- Rewind Theory: the "what do you miss?" wall.
--
-- Rewind Theory is the static site under public/rewind. Its page text and
-- polaroid photos live in site_content under the key "rewind", the same way
-- LastThread's do, so they need nothing here. The wall is different: anybody
-- who visits can pin something to it, signed in or not, so it needs a table
-- of its own with rules about who can do what.
--
-- What a visitor can do: add one row, and only as unapproved. They cannot
-- read anything that is not approved, their own post included, and they can
-- never change or delete a row.
--
-- What an admin can do: read everything, approve, delete, and add rows that
-- are approved straight away. "Admin" is the feed's own profiles.is_admin
-- flag, the same one that guards Admin on mythefeed.com.
--
-- What becomes public: the text, the optional name, and the YouTube link or
-- picture of every post an admin approves. Nothing else, and nothing about
-- who sent it.
--
-- Pictures are stored in the row as a small JPEG data URL. The page shrinks
-- them to 402x300 before sending, which comes out around 30-60KB; the check
-- below refuses anything far past that so nobody can fill the database
-- with one request.
--
-- Safe to run more than once. The undo block is at the bottom.

create table if not exists public.rewind_wall (
  id         uuid primary key default gen_random_uuid(),
  text       text not null check (char_length(text) between 1 and 120),
  who        text check (who is null or char_length(who) <= 40),
  kind       text not null check (kind in ('yt', 'img')),
  url        text check (url is null or char_length(url) <= 200),
  image      text check (image is null or char_length(image) <= 250000),
  approved   boolean not null default false,
  created_at timestamptz not null default now(),
  check ((kind = 'yt' and url is not null) or (kind = 'img' and image is not null))
);

create index if not exists rewind_wall_approved_created_idx
  on public.rewind_wall (approved, created_at desc);

alter table public.rewind_wall enable row level security;

drop policy if exists "Approved wall posts are viewable by everyone" on public.rewind_wall;
create policy "Approved wall posts are viewable by everyone"
  on public.rewind_wall for select
  using (
    approved
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

drop policy if exists "Anyone can pin to the wall for approval" on public.rewind_wall;
create policy "Anyone can pin to the wall for approval"
  on public.rewind_wall for insert
  with check (
    not approved
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

drop policy if exists "Admins can approve wall posts" on public.rewind_wall;
create policy "Admins can approve wall posts"
  on public.rewind_wall for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "Admins can delete wall posts" on public.rewind_wall;
create policy "Admins can delete wall posts"
  on public.rewind_wall for delete
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ---------- to undo all of it ----------
--
-- drop table if exists public.rewind_wall;
