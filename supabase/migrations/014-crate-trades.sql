-- Run this once in the Supabase SQL editor, same as the others.
--
-- Trading records out of the crate.
--
-- Taking a record out of the crate puts it on your list and that is the
-- end of it. Which is only half of what a crate is for: the other half
-- of digging through a box of records with other people is holding one
-- up and asking what they will give you for it.
--
-- The shape here is a record fair, not a marketplace. Nothing is for
-- sale, there is no currency, and you cannot ask for something without
-- putting something up yourself. One of mine for one of yours, they say
-- yes or they say no.
--
-- Safe to run more than once.

-- ---------- crate_offers ----------
-- A record somebody has put out on the table.
--
-- Deliberately its own table rather than a flag on queue_items, for one
-- reason: the queue is PRIVATE and it should stay that way. Nobody
-- should have to expose everything they mean to listen to in order to
-- swap one record. Putting a record up for trade is a separate, explicit
-- act, and only what you put up is visible.
--
-- The record's details are copied here rather than pointed at, because
-- an offer has to survive the queue item being ticked off or deleted.
-- Somebody clearing their list should not silently withdraw their half
-- of a trade another person is in the middle of considering.
create table if not exists public.crate_offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  artist text,
  image_url text,
  -- Why this one. Optional, and the thing that makes a table of records
  -- into a table somebody laid out: "too clean for me", "I have two".
  note text,
  created_at timestamptz not null default now(),
  -- Off the table: traded away, or taken back. Both end an offer, and
  -- which one it was is answered by whether a settled trade points at
  -- it, so there is no status column here to disagree with that.
  closed_at timestamptz
);

-- The same record twice on one person's table is a mistake, not an
-- inventory. Partial, so a record can go back up after a trade falls
-- through - which is the normal case, not an edge one.
create unique index if not exists crate_offers_open_unique_idx
  on public.crate_offers (user_id, lower(title))
  where closed_at is null;

-- The trading table itself: everything still up, newest first.
create index if not exists crate_offers_open_idx
  on public.crate_offers (closed_at, created_at desc);

alter table public.crate_offers enable row level security;

-- Public, and that is the point of the table. An offer nobody can see is
-- not an offer. Closed ones stay readable so a settled trade can still
-- show what was swapped.
drop policy if exists "Crate offers are public" on public.crate_offers;
create policy "Crate offers are public"
  on public.crate_offers for select
  using (true);

drop policy if exists "Users put up their own records" on public.crate_offers;
create policy "Users put up their own records"
  on public.crate_offers for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users manage their own offers" on public.crate_offers;
create policy "Users manage their own offers"
  on public.crate_offers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users take back their own offers" on public.crate_offers;
create policy "Users take back their own offers"
  on public.crate_offers for delete
  using (auth.uid() = user_id);

-- ---------- crate_trades ----------
-- One proposed swap: this one of mine, for that one of yours.
create table if not exists public.crate_trades (
  id uuid primary key default gen_random_uuid(),
  -- Who asked, and who has to answer.
  proposer_id uuid not null references public.profiles (id) on delete cascade,
  holder_id uuid not null references public.profiles (id) on delete cascade,
  -- What they want, and what they are putting up for it. Both offers are
  -- required: an offer with nothing against it is begging, and the whole
  -- reason this is a trade rather than a request is that it costs the
  -- asker something.
  wants_offer_id uuid not null references public.crate_offers (id) on delete cascade,
  gives_offer_id uuid not null references public.crate_offers (id) on delete cascade,
  note text,
  -- open until somebody answers. Withdrawn is the proposer changing
  -- their mind; declined is the holder saying no. Kept apart because
  -- "they said no" and "they thought better of it" are different things
  -- to read in a list.
  status text not null default 'open'
    check (status in ('open', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  -- Trading with yourself is not a trade.
  constraint crate_trades_not_self check (proposer_id <> holder_id),
  -- And neither is offering something for itself.
  constraint crate_trades_two_records check (wants_offer_id <> gives_offer_id)
);

-- One live proposal per pair of records. Asking again for the same
-- record with the same record is nagging, and the index lets the action
-- treat a repeat as success rather than telling somebody off.
create unique index if not exists crate_trades_open_unique_idx
  on public.crate_trades (proposer_id, wants_offer_id, gives_offer_id)
  where status = 'open';

-- The two inbox queries: what I have been asked for, and what I asked.
create index if not exists crate_trades_holder_idx
  on public.crate_trades (holder_id, status, created_at desc);
create index if not exists crate_trades_proposer_idx
  on public.crate_trades (proposer_id, status, created_at desc);

alter table public.crate_trades enable row level security;

-- Between the two of them. Unlike the offers, a proposal is private:
-- being turned down in public is a reason not to ask, and the site wants
-- people asking.
drop policy if exists "Trades are visible to both sides" on public.crate_trades;
create policy "Trades are visible to both sides"
  on public.crate_trades for select
  using (auth.uid() = proposer_id or auth.uid() = holder_id);

-- You can only propose as yourself, only offer a record that is actually
-- yours and still up, and only ask for one that is somebody else's and
-- still up. Checked here rather than only in the action, because an
-- offer nobody owns is the sort of row that turns into a trade nobody
-- can settle.
drop policy if exists "Users propose their own trades" on public.crate_trades;
create policy "Users propose their own trades"
  on public.crate_trades for insert
  with check (
    auth.uid() = proposer_id
    and exists (
      select 1 from public.crate_offers o
      where o.id = gives_offer_id and o.user_id = auth.uid() and o.closed_at is null
    )
    and exists (
      select 1 from public.crate_offers o
      where o.id = wants_offer_id and o.user_id = holder_id and o.closed_at is null
    )
  );

-- Either side can settle one: the holder answers it, the proposer takes
-- it back. Which of the two they are allowed to write is enforced in the
-- action, since a policy cannot see which column changed.
drop policy if exists "Either side settles a trade" on public.crate_trades;
create policy "Either side settles a trade"
  on public.crate_trades for update
  using (auth.uid() = proposer_id or auth.uid() = holder_id)
  with check (auth.uid() = proposer_id or auth.uid() = holder_id);
