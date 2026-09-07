-- Run this once in the Supabase SQL editor.
--
-- Making the YouTube allowance survive a busy day.
--
-- YouTube gives 10,000 units a day and a search costs 100 of them, so
-- the whole site gets a hundred searches between everybody, every day.
-- That was being spent by pages refreshing themselves rather than by
-- anybody pressing anything: every distinct film shelf is a search, the
-- Feed TV fills itself with up to four, the Discover rails try three
-- lanes, and each one of those is a hundred units.
--
-- Worse, none of it was remembered anywhere durable. The cache lived in
-- the deployment, so every push to the site threw it away and the next
-- visitor paid for all of it again. A day with five deploys cost five
-- times what it should have.
--
-- Two tables. One remembers what YouTube said, for everybody and across
-- deploys. The other counts what has been spent today, so background
-- refreshes can be told to stop while somebody pressing play is still
-- served.
--
-- Both are written by the server with the service-role key. Neither has
-- an insert policy, because a shared cache anybody can write to is a
-- shared cache one person can poison.
--
-- Safe to run more than once.

-- ---------- what YouTube said ----------
create table if not exists public.youtube_searches (
  -- A hash of the query and the options, so two different searches can
  -- never collide on one row.
  query_key text primary key,
  -- Kept for reading the table by eye when something looks wrong: a
  -- key alone tells you nothing about what was asked.
  query text not null,
  -- The parsed videos, exactly as the site uses them.
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

-- The sweep that clears out what nobody has asked for in a while.
create index if not exists youtube_searches_fetched_idx
  on public.youtube_searches (fetched_at);

alter table public.youtube_searches enable row level security;

drop policy if exists "Cached searches are viewable by everyone" on public.youtube_searches;
create policy "Cached searches are viewable by everyone"
  on public.youtube_searches for select
  using (true);

-- ---------- what has been spent ----------
create table if not exists public.youtube_usage (
  -- One row per UTC day, which is when Google resets the allowance.
  day date primary key,
  units int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.youtube_usage enable row level security;

drop policy if exists "Usage is viewable by everyone" on public.youtube_usage;
create policy "Usage is viewable by everyone"
  on public.youtube_usage for select
  using (true);

-- Adding to the count has to be atomic, or two page views at the same
-- moment both read 900, both write 1000, and 100 units vanish from the
-- accounting. Over a busy day that is how a budget quietly overruns.
create or replace function public.spend_youtube_units(amount int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  total int;
begin
  insert into public.youtube_usage (day, units, updated_at)
    values (current_date, amount, now())
  on conflict (day) do update
    set units = public.youtube_usage.units + amount,
        updated_at = now()
  returning units into total;
  return total;
end;
$$;
