-- The record store: a shop you walk around, a crate you fill, and a
-- bedroom where the things you took home live.
--
-- Additive only. Every statement creates something new; nothing that
-- exists today is altered, dropped or written to, except two rows this
-- file never touches directly: a store review is also an ordinary review
-- (a row in posts) and links to its work (a row in works), exactly as a
-- review written in the composer does.
--
-- Safe to run more than once. The undo block is at the bottom.
--
-- The rules, and where each one is enforced:
--
--   Five things a day, music and films together. A "day" is the UTC
--   date. Counted from store_owned in store_checkout, under a per-person
--   lock, so two checkouts sent at the same moment cannot both squeeze
--   in under the limit.
--
--   Nothing twice. store_owned's primary key is (user_id, item_id); the
--   crate refuses an owned item; checkout refuses one too. Two copies of
--   the same album under different Apple ids are one item, because the
--   catalogue is unique on the site's own work key.
--
--   Reviewing from the bedroom needs ownership. store_reviews has a
--   foreign key to store_owned, so the database itself will not hold a
--   bedroom review of something the writer does not own.
--
--   Not open to the public until launch. Every write checks
--   store_is_open_for(): an admin, or anyone once the launch time in
--   site_settings has passed. That is checked here rather than only in
--   the page, because the anon key is public and any of these functions
--   can be called without going near the site.
--
-- Members never write these tables directly: there are no insert, update
-- or delete policies. Everything goes through the functions below, which
-- run as their owner and check the caller themselves.

-- ---------- the catalogue ----------
-- Everything the shop has ever been able to stock. Filled from Apple's
-- catalogue by the server (service role), one confirmed match at a time,
-- so every row's artwork came from the same catalogue record as its
-- title. Rows are never deleted by the app; an item that turns out to be
-- wrong is switched off with `active`.
create table if not exists public.store_items (
  id uuid primary key default gen_random_uuid(),
  -- workKey() from src/lib/works.ts, the site's one identity for a thing.
  work_key text not null,
  media_type text not null check (media_type in ('music', 'movie_tv')),
  format text not null check (format in ('cd', 'vinyl', 'cassette', 'dvd')),
  title text not null,
  -- The artist for music; the director for a film, when Apple names one.
  artist text,
  year smallint,
  genre text,
  blurb text,
  artwork_url text not null,
  preview_url text,
  -- What the preview is: a track title, or "Trailer".
  preview_label text,
  -- The catalogue page, linked wherever the artwork is shown.
  store_url text,
  source text not null default 'itunes',
  source_id text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists store_items_work_key_idx on public.store_items (work_key);
create unique index if not exists store_items_source_idx on public.store_items (source, source_id);
create index if not exists store_items_format_idx on public.store_items (format) where active;

alter table public.store_items enable row level security;

drop policy if exists "Store items are viewable by everyone" on public.store_items;
create policy "Store items are viewable by everyone"
  on public.store_items for select
  using (true);

-- Which seeds the restock has already asked Apple about, so a miss is
-- not asked about again every day.
create table if not exists public.store_candidates (
  key text primary key,
  found smallint not null default 0,
  tried_at timestamptz not null default now()
);

alter table public.store_candidates enable row level security;
-- No policies: server only.

-- ---------- the shelves, one set per UTC day ----------
-- Chosen the first time anybody opens the shop that day, then only ever
-- added to, never reshuffled: something in somebody's crate must still be
-- on the shelf when they reach the till.
create table if not exists public.store_stock (
  day date not null,
  item_id uuid not null references public.store_items (id) on delete cascade,
  section text not null check (section in ('cd', 'vinyl', 'cassette', 'dvd')),
  slot smallint not null,
  primary key (day, item_id),
  unique (day, section, slot)
);

alter table public.store_stock enable row level security;

drop policy if exists "Store stock is viewable by everyone" on public.store_stock;
create policy "Store stock is viewable by everyone"
  on public.store_stock for select
  using (true);

-- ---------- the crate: temporary ----------
-- What somebody is carrying around the shop today. Emptied at checkout,
-- and anything left in it from an earlier UTC day is thrown out, because
-- that day's shelves are gone.
create table if not exists public.store_crate (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid not null references public.store_items (id) on delete cascade,
  day date not null,
  added_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

alter table public.store_crate enable row level security;

drop policy if exists "You can see your own crate" on public.store_crate;
create policy "You can see your own crate"
  on public.store_crate for select
  using (auth.uid() = user_id);

-- ---------- owned: permanent ----------
-- Everything somebody has ever taken home. This is the bedroom's shelf,
-- and the daily limit is counted from it.
create table if not exists public.store_owned (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id uuid not null references public.store_items (id) on delete restrict,
  -- The UTC date of the checkout, which is what the limit counts.
  day date not null,
  checked_out_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create index if not exists store_owned_day_idx on public.store_owned (user_id, day);

alter table public.store_owned enable row level security;

drop policy if exists "You can see what you own" on public.store_owned;
create policy "You can see what you own"
  on public.store_owned for select
  using (auth.uid() = user_id);

-- ---------- reviews written in the bedroom ----------
-- The review itself is an ordinary row in posts, so it is in the feed,
-- on the work's page and everywhere else reviews are. This row says it
-- was written about something the writer owns, and the foreign key to
-- store_owned is what makes that a rule rather than a hope. Deleting the
-- post (its author, or an admin moderating) removes this row with it.
create table if not exists public.store_reviews (
  user_id uuid not null,
  item_id uuid not null,
  post_id uuid not null unique references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id),
  foreign key (user_id, item_id) references public.store_owned (user_id, item_id) on delete cascade
);

create index if not exists store_reviews_recent_idx on public.store_reviews (created_at desc);

alter table public.store_reviews enable row level security;

-- Public, like the reviews themselves: this is the community board.
drop policy if exists "Store reviews are viewable by everyone" on public.store_reviews;
create policy "Store reviews are viewable by everyone"
  on public.store_reviews for select
  using (true);

-- ---------- rules ----------

create or replace function public.store_daily_limit() returns int
language sql immutable as $$ select 5 $$;

create or replace function public.store_today() returns date
language sql stable as $$ select (now() at time zone 'utc')::date $$;

-- The launch time, or null when no countdown has been started. Written by
-- an admin through site_settings, as an ISO timestamp. Anything that is
-- not one reads as "not set", never as "open".
create or replace function public.store_launch_at() returns timestamptz
language plpgsql stable security definer set search_path = public as $$
declare
  raw text;
begin
  select value into raw from public.site_settings where key = 'store_launch_at';
  if raw is null then return null; end if;
  return raw::timestamptz;
exception when others then
  return null;
end $$;

create or replace function public.store_is_open_for(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    coalesce((select is_admin from public.profiles where id = p_user), false)
    or coalesce(public.store_launch_at() <= now(), false)
$$;

-- Who is calling, checked. Returns their id or raises.
create or replace function public.store_caller() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  is_banned boolean;
begin
  if uid is null then
    raise exception 'STORE_SIGNED_OUT' using errcode = 'P0001';
  end if;
  select banned into is_banned from public.profiles where id = uid;
  if is_banned is null then
    raise exception 'STORE_SIGNED_OUT' using errcode = 'P0001';
  end if;
  if is_banned then
    raise exception 'STORE_BANNED' using errcode = 'P0001';
  end if;
  if not public.store_is_open_for(uid) then
    raise exception 'STORE_CLOSED' using errcode = 'P0001';
  end if;
  return uid;
end $$;

-- Section sizes. Match SECTIONS in src/lib/store.ts.
create or replace function public.store_section_cap(p_section text) returns int
language sql immutable as $$
  select case p_section
    when 'cd' then 12
    when 'vinyl' then 8
    when 'cassette' then 10
    when 'dvd' then 10
    else 0
  end
$$;

-- Today's shelves, filled up to size from the catalogue.
--
-- Deterministic for the day (ordered by a hash of the date and the item),
-- so it does not matter who opens the shop first. Things that were on the
-- shelves yesterday go to the back of the queue, so the shop looks
-- different each day whenever the catalogue is big enough to allow it.
-- Only ever adds: a slot, once filled, keeps its item until midnight UTC.
create or replace function public.store_ensure_stock() returns void
language plpgsql volatile security definer set search_path = public as $$
declare
  today date := public.store_today();
  sec text;
  have int;
  top int;
  cap int;
begin
  perform pg_advisory_xact_lock(hashtext('store_stock'));
  foreach sec in array array['cd', 'vinyl', 'cassette', 'dvd'] loop
    cap := public.store_section_cap(sec);
    select count(*), coalesce(max(slot), 0) into have, top
      from public.store_stock where day = today and section = sec;
    if have < cap then
      insert into public.store_stock (day, item_id, section, slot)
      select today, picked.id, sec, top + picked.n
      from (
        select i.id,
               row_number() over (
                 order by (y.item_id is not null), md5(today::text || i.id::text)
               ) as n
        from public.store_items i
        left join public.store_stock y on y.day = today - 1 and y.item_id = i.id
        where i.format = sec
          and i.active
          and not exists (
            select 1 from public.store_stock s where s.day = today and s.item_id = i.id
          )
      ) picked
      where picked.n <= cap - have
      on conflict do nothing;
    end if;
  end loop;
end $$;

-- Where the caller stands today. Safe to call signed out: it then reports
-- an empty crate and a full allowance, and `open` says whether they could
-- shop at all.
create or replace function public.store_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  today date := public.store_today();
  used int := 0;
  in_crate int := 0;
begin
  if uid is not null then
    select count(*) into used from public.store_owned where user_id = uid and day = today;
    select count(*) into in_crate from public.store_crate where user_id = uid and day = today;
  end if;
  return jsonb_build_object(
    'day', today,
    'limit', public.store_daily_limit(),
    'usedToday', used,
    'inCrate', in_crate,
    'remaining', greatest(0, public.store_daily_limit() - used - in_crate),
    'open', uid is not null and public.store_is_open_for(uid),
    'launchAt', public.store_launch_at()
  );
end $$;

-- Put something from today's shelves in the crate.
--
-- The crate counts against the day's allowance as well as what has
-- already been checked out, so it can never hold more than could actually
-- be taken home.
create or replace function public.store_crate_add(p_item uuid) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := public.store_caller();
  today date := public.store_today();
  used int;
  in_crate int;
begin
  perform pg_advisory_xact_lock(hashtextextended('store:' || uid::text, 0));
  delete from public.store_crate where user_id = uid and day < today;

  if not exists (
    select 1
    from public.store_stock s
    join public.store_items i on i.id = s.item_id
    where s.day = today and s.item_id = p_item and i.active
  ) then
    raise exception 'STORE_NOT_IN_STOCK' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.store_owned where user_id = uid and item_id = p_item) then
    raise exception 'STORE_OWNED' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.store_crate where user_id = uid and item_id = p_item) then
    raise exception 'STORE_IN_CRATE' using errcode = 'P0001';
  end if;

  select count(*) into used from public.store_owned where user_id = uid and day = today;
  select count(*) into in_crate from public.store_crate where user_id = uid;
  if used + in_crate + 1 > public.store_daily_limit() then
    raise exception 'STORE_LIMIT' using errcode = 'P0001';
  end if;

  insert into public.store_crate (user_id, item_id, day) values (uid, p_item, today);
  return public.store_status();
end $$;

create or replace function public.store_crate_remove(p_item uuid) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := public.store_caller();
begin
  perform pg_advisory_xact_lock(hashtextextended('store:' || uid::text, 0));
  delete from public.store_crate where user_id = uid and item_id = p_item;
  return public.store_status();
end $$;

-- Pay for the crate: everything in it moves to store_owned, and the crate
-- is emptied. All or nothing, in one transaction, under the same
-- per-person lock as the crate, so two checkouts at once queue up and the
-- second one sees what the first one took.
create or replace function public.store_checkout() returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := public.store_caller();
  today date := public.store_today();
  used int;
  wanted int;
  taken int;
  dropped int;
begin
  perform pg_advisory_xact_lock(hashtextextended('store:' || uid::text, 0));
  delete from public.store_crate where user_id = uid and day < today;

  -- Anything no longer on today's shelves, switched off, or somehow
  -- already owned cannot be bought. Taken out and reported, not charged.
  with gone as (
    delete from public.store_crate c
    where c.user_id = uid
      and (
        not exists (
          select 1
          from public.store_stock s
          join public.store_items i on i.id = s.item_id
          where s.day = today and s.item_id = c.item_id and i.active
        )
        or exists (
          select 1 from public.store_owned o where o.user_id = uid and o.item_id = c.item_id
        )
      )
    returning 1
  )
  select count(*) into dropped from gone;

  select count(*) into wanted from public.store_crate where user_id = uid;
  if wanted = 0 then
    raise exception 'STORE_EMPTY' using errcode = 'P0001';
  end if;

  select count(*) into used from public.store_owned where user_id = uid and day = today;
  if used + wanted > public.store_daily_limit() then
    raise exception 'STORE_LIMIT' using errcode = 'P0001';
  end if;

  insert into public.store_owned (user_id, item_id, day)
  select uid, c.item_id, today from public.store_crate c where c.user_id = uid;
  get diagnostics taken = row_count;

  delete from public.store_crate where user_id = uid;

  return public.store_status() || jsonb_build_object('checkedOut', taken, 'dropped', dropped);
end $$;

-- Write (or rewrite) the review of something you own.
--
-- One per item per person; writing again edits the same review rather
-- than posting a second one. The words are checked by the server action
-- before this is called (checkReviewSafety lives in TypeScript); this
-- checks everything that has to hold even when it is called directly.
create or replace function public.store_submit_review(
  p_item uuid,
  p_rating int,
  p_body text
) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := public.store_caller();
  v_body text := btrim(coalesce(p_body, ''));
  item public.store_items%rowtype;
  existing uuid;
  work uuid;
  post uuid;
begin
  if p_rating is not null and (p_rating < 1 or p_rating > 5) then
    raise exception 'STORE_BAD_REVIEW' using errcode = 'P0001';
  end if;
  if v_body = '' and p_rating is null then
    raise exception 'STORE_BAD_REVIEW' using errcode = 'P0001';
  end if;
  if length(v_body) > 5000 then
    raise exception 'STORE_BAD_REVIEW' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.store_owned where user_id = uid and item_id = p_item) then
    raise exception 'STORE_NOT_OWNED' using errcode = 'P0001';
  end if;

  select * into item from public.store_items where id = p_item;

  select post_id into existing from public.store_reviews where user_id = uid and item_id = p_item;
  if existing is not null then
    update public.posts p set body = v_body, rating = p_rating
      where p.id = existing and p.user_id = uid;
    update public.store_reviews set updated_at = now()
      where user_id = uid and item_id = p_item;
    return existing;
  end if;

  -- The same work every other review of this thing belongs to.
  select id into work from public.works where work_key = item.work_key;
  if work is null then
    insert into public.works (work_key, media_type, title, artist, cover_url)
    values (item.work_key, item.media_type, left(item.title, 200), left(item.artist, 200), item.artwork_url)
    on conflict (work_key) do nothing
    returning id into work;
    if work is null then
      select id into work from public.works where work_key = item.work_key;
    end if;
  end if;

  insert into public.posts (user_id, media_type, title, artist, body, rating, cover_url, work_id)
  values (
    uid,
    item.media_type,
    item.title,
    case when item.media_type = 'music' then item.artist else null end,
    v_body,
    p_rating,
    item.artwork_url,
    work
  )
  returning id into post;

  insert into public.store_reviews (user_id, item_id, post_id) values (uid, p_item, post);
  return post;
end $$;

-- ---------- who may call what ----------
revoke all on function public.store_ensure_stock() from public;
revoke all on function public.store_status() from public;
revoke all on function public.store_crate_add(uuid) from public;
revoke all on function public.store_crate_remove(uuid) from public;
revoke all on function public.store_checkout() from public;
revoke all on function public.store_submit_review(uuid, int, text) from public;
revoke all on function public.store_caller() from public;
-- Supabase also grants execute to anon and authenticated directly, so
-- revoking from public is not enough on its own for the write functions.
revoke all on function public.store_crate_add(uuid) from anon;
revoke all on function public.store_crate_remove(uuid) from anon;
revoke all on function public.store_checkout() from anon;
revoke all on function public.store_submit_review(uuid, int, text) from anon;
revoke all on function public.store_caller() from anon, authenticated;

grant execute on function public.store_ensure_stock() to anon, authenticated, service_role;
grant execute on function public.store_status() to anon, authenticated, service_role;
grant execute on function public.store_crate_add(uuid) to authenticated;
grant execute on function public.store_crate_remove(uuid) to authenticated;
grant execute on function public.store_checkout() to authenticated;
grant execute on function public.store_submit_review(uuid, int, text) to authenticated;
grant execute on function public.store_is_open_for(uuid) to anon, authenticated, service_role;
grant execute on function public.store_launch_at() to anon, authenticated, service_role;

-- Supabase grants every role everything on new tables and relies on
-- row-level security. These have no write policies, so RLS already
-- refuses; the revoke makes it refuse before RLS is even asked.
revoke insert, update, delete, truncate on
  public.store_items, public.store_candidates, public.store_stock,
  public.store_crate, public.store_owned, public.store_reviews
  from anon, authenticated;
revoke all on public.store_candidates from anon, authenticated;

grant select on public.store_items, public.store_stock, public.store_reviews to anon, authenticated;
grant select on public.store_crate, public.store_owned to authenticated;
grant all on public.store_items, public.store_candidates, public.store_stock to service_role;

-- ---------- undo ----------
-- Removes everything above. Bedroom reviews stay as ordinary reviews in
-- posts; only the record of which item they were about goes.
--
-- drop function if exists public.store_submit_review(uuid, int, text);
-- drop function if exists public.store_checkout();
-- drop function if exists public.store_crate_remove(uuid);
-- drop function if exists public.store_crate_add(uuid);
-- drop function if exists public.store_status();
-- drop function if exists public.store_ensure_stock();
-- drop function if exists public.store_section_cap(text);
-- drop function if exists public.store_caller();
-- drop function if exists public.store_is_open_for(uuid);
-- drop function if exists public.store_launch_at();
-- drop function if exists public.store_today();
-- drop function if exists public.store_daily_limit();
-- drop table if exists public.store_reviews;
-- drop table if exists public.store_owned;
-- drop table if exists public.store_crate;
-- drop table if exists public.store_stock;
-- drop table if exists public.store_candidates;
-- drop table if exists public.store_items;
-- delete from public.site_settings where key = 'store_launch_at';
