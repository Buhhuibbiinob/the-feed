-- Run this once in the Supabase SQL editor, same as the others.
--
-- Announcements: something the admin writes once that everybody sees.
-- Until now the only way to tell 13 people something was to post a review
-- about it and hope they scrolled.
--
-- Safe to run more than once.

-- ---------- announcements ----------
-- Two shapes, because "the site is down for an hour tonight" and "there
-- are new stickers" do not deserve the same amount of interruption:
--
--   alert  - the modal. Stops you, has to be dismissed, seen once.
--   banner - a strip under the nav. Sits there while it is live.
--
-- starts_at/ends_at rather than remembering to switch it off: an
-- announcement about a thing that happens on Friday should stop being
-- news on Saturday whether or not anyone was around to untick it.
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  style text not null default 'alert' check (style in ('alert', 'banner')),
  -- The optional second button. Both or neither: a button with no
  -- destination is a button that does nothing, so the app ignores a
  -- label without a url.
  button_label text,
  link_url text,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists announcements_live_idx
  on public.announcements (active, created_at desc);

alter table public.announcements enable row level security;

-- Readable by everybody, including signed-out visitors - an announcement
-- nobody can read is not an announcement.
--
-- But only once it is live. An admin drafting "we are shutting down on
-- the 30th" three days early should not have that readable by anyone who
-- knows how to query the API, so the window is enforced HERE rather than
-- only in the app's own filter.
drop policy if exists "Live announcements are viewable by everyone" on public.announcements;
create policy "Live announcements are viewable by everyone"
  on public.announcements for select
  using (
    (
      active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now())
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin
    )
  );

drop policy if exists "Admins can write announcements" on public.announcements;
create policy "Admins can write announcements"
  on public.announcements for insert
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

drop policy if exists "Admins can update announcements" on public.announcements;
create policy "Admins can update announcements"
  on public.announcements for update
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

drop policy if exists "Admins can delete announcements" on public.announcements;
create policy "Admins can delete announcements"
  on public.announcements for delete
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- ---------- announcement_dismissals ----------
-- "I have read this one." Kept in the database rather than only in the
-- browser so that closing an alert on your phone also closes it on your
-- laptop. Signed-out visitors have no row to write and fall back to
-- localStorage, which is the right trade: they get the same "once" on
-- the device they are actually using.
create table if not exists public.announcement_dismissals (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

alter table public.announcement_dismissals enable row level security;

drop policy if exists "Dismissals are viewable by their owner" on public.announcement_dismissals;
create policy "Dismissals are viewable by their owner"
  on public.announcement_dismissals for select
  using (auth.uid() = user_id);

drop policy if exists "Users can dismiss announcements" on public.announcement_dismissals;
create policy "Users can dismiss announcements"
  on public.announcement_dismissals for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can undismiss announcements" on public.announcement_dismissals;
create policy "Users can undismiss announcements"
  on public.announcement_dismissals for delete
  using (auth.uid() = user_id);
