-- Run this once in the Supabase SQL editor, same as the others.
--
-- Two columns for the win-back email: when the last nudge was sent, and
-- how many have been sent in total. Safe to run more than once.

-- ---------- Win-back nudges ----------
-- The activity digest can only report what other people did to you, so a
-- member nobody has responded to gets no digest, ever - and that is
-- exactly the member who posts once and disappears. The nudge is a
-- separate channel triggered by absence rather than by activity.
--
-- These columns exist to keep it from becoming spam. nudge_sent_at
-- enforces a cooldown between nudges; nudge_count caps how many a single
-- account can ever receive, so a long-dead account isn't emailed
-- every month forever.
alter table public.profiles add column if not exists nudge_sent_at timestamptz;
alter table public.profiles add column if not exists nudge_count integer not null default 0;
