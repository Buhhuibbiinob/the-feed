#!/usr/bin/env bash
# The store's database rules, tested against a throwaway local Postgres.
#
# Never touches Supabase. It starts a private Postgres in a temporary
# directory, loads supabase/schema.sql and every migration into it on top
# of a few stand-ins for Supabase's own pieces (supabase/test), runs the
# checks, and deletes the lot.
#
# Needs the Postgres 16 server binaries (initdb, pg_ctl, postgres) and
# psql. On Ubuntu: apt install postgresql-16. On a Mac: brew install
# postgresql@16, then put its bin directory on PATH.
#
# Run: npm run check:storedb
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-}"
if [ -z "$PGBIN" ]; then
  for d in /usr/lib/postgresql/16/bin /opt/homebrew/opt/postgresql@16/bin /usr/local/opt/postgresql@16/bin; do
    [ -x "$d/initdb" ] && PGBIN="$d" && break
  done
fi
if [ -z "$PGBIN" ] && command -v initdb >/dev/null; then PGBIN="$(dirname "$(command -v initdb)")"; fi
if [ -z "$PGBIN" ]; then
  echo "No Postgres server binaries found. Install Postgres 16, or set PGBIN." >&2
  exit 2
fi

WORK="$(mktemp -d "${TMPDIR:-/tmp}/store-db-check.XXXXXX")"
# Postgres refuses to run as root, so a root shell (a container, CI) runs
# the server as the postgres user instead.
AS=()
if [ "$(id -u)" = "0" ]; then
  chown postgres "$WORK"
  AS=(runuser -u postgres --)
fi
cleanup() {
  "${AS[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

"${AS[@]}" "$PGBIN/initdb" -D "$WORK/data" -A trust -U postgres >/dev/null
"${AS[@]}" "$PGBIN/pg_ctl" -D "$WORK/data" -o "-k $WORK -c listen_addresses='' -c max_connections=60" \
  -l "$WORK/log" -w start >/dev/null

PSQL=(psql -h "$WORK" -U postgres -d store -v ON_ERROR_STOP=1 -v VERBOSITY=terse -qtA)
psql -h "$WORK" -U postgres -qc "create database store"

failures=0
ok() { echo "ok    $1"; }
fail() { echo "FAIL  $1${2:+ - $2}"; failures=$((failures + 1)); }

# Run SQL as a signed-in member, the way PostgREST does: the
# authenticated role, with the member's id as the JWT subject.
as_user() {
  local uid="$1"; shift
  # A refusal is an answer the checks look at, not a reason to stop.
  { "${PSQL[@]}" -c "set role authenticated; select set_config('request.jwt.claim.sub', '$uid', false); $*" 2>&1 || true; } | tail -n 1
}
expect_value() {
  local name="$1" want="$2" got="$3"
  if [ "$got" = "$want" ]; then ok "$name"; else fail "$name" "wanted '$want', got '$got'"; fi
}
expect_error() {
  local name="$1" code="$2" got="$3"
  if [[ "$got" == *"$code"* ]]; then ok "$name"; else fail "$name" "wanted $code, got '$got'"; fi
}

# ---------- load ----------
load_all() {
  cat "$ROOT/supabase/test/supabase-stubs.sql" "$ROOT/supabase/schema.sql" "$ROOT"/supabase/migrations/*.sql \
    | "${PSQL[@]}" >/dev/null 2>"$WORK/load.err" || true
  if grep -q ERROR "$WORK/load.err"; then
    fail "schema and migrations load" "$(grep ERROR "$WORK/load.err" | head -3)"
    exit 1
  fi
}
load_all
ok "schema.sql and every migration load"
load_all
ok "loading everything a second time is harmless (migrations re-runnable)"

# ---------- fixtures ----------
"${PSQL[@]}" >/dev/null <<'SQL'
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test', '{"username":"alice"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test', '{"username":"bob"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test', '{"username":"carol"}'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@test', '{"username":"admin"}'),
  ('00000000-0000-0000-0000-0000000000ba', 'banned@test', '{"username":"banned"}');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-0000000000ad';
update public.profiles set banned = true where id = '00000000-0000-0000-0000-0000000000ba';

-- 20 CDs, 3 LPs, 2 tapes, 12 DVDs, and one CD switched off.
insert into public.store_items (work_key, media_type, format, title, artist, year, artwork_url, source_id)
select 'music:artist ' || n || ':album ' || n, 'music', 'cd', 'Album ' || n, 'Artist ' || n, 2001,
       'https://example.test/' || n || '.jpg', 'cd' || n
from generate_series(1, 20) n;
insert into public.store_items (work_key, media_type, format, title, artist, year, artwork_url, source_id)
select 'music:lp artist ' || n || ':lp ' || n, 'music', 'vinyl', 'LP ' || n, 'LP Artist ' || n, 1972,
       'https://example.test/lp' || n || '.jpg', 'lp' || n
from generate_series(1, 3) n;
insert into public.store_items (work_key, media_type, format, title, artist, year, artwork_url, source_id)
select 'music:tape artist ' || n || ':tape ' || n, 'music', 'cassette', 'Tape ' || n, 'Tape Artist ' || n, 1985,
       'https://example.test/t' || n || '.jpg', 'tape' || n
from generate_series(1, 2) n;
insert into public.store_items (work_key, media_type, format, title, artist, year, artwork_url, source_id)
select 'movie_tv:film ' || n, 'movie_tv', 'dvd', 'Film ' || n, 'Director ' || n, 1999,
       'https://example.test/f' || n || '.jpg', 'film' || n
from generate_series(1, 12) n;
insert into public.store_items (work_key, media_type, format, title, artist, year, artwork_url, source_id, active)
values ('music:off:off', 'music', 'cd', 'Pulled', 'Off', 2000, 'https://example.test/off.jpg', 'off', false);
SQL

A=00000000-0000-0000-0000-00000000000a
B=00000000-0000-0000-0000-00000000000b
C=00000000-0000-0000-0000-00000000000c
ADMIN=00000000-0000-0000-0000-0000000000ad
BANNED=00000000-0000-0000-0000-0000000000ba

item() { "${PSQL[@]}" -c "select id from public.store_items where source_id = '$1'"; }
stocked() { # the nth item on today's shelf for a section
  "${PSQL[@]}" -c "select item_id from public.store_stock where day = public.store_today() and section = '$1' order by slot offset $(( $2 - 1 )) limit 1"
}

# ---------- shelves ----------
"${PSQL[@]}" -c "select public.store_ensure_stock()" >/dev/null
expect_value "CD shelf fills to its 12 slots from a catalogue of 20" "12" \
  "$("${PSQL[@]}" -c "select count(*) from public.store_stock where day = public.store_today() and section = 'cd'")"
expect_value "a short section holds what exists (3 LPs)" "3" \
  "$("${PSQL[@]}" -c "select count(*) from public.store_stock where day = public.store_today() and section = 'vinyl'")"
expect_value "a switched-off item is never stocked" "0" \
  "$("${PSQL[@]}" -c "select count(*) from public.store_stock s join public.store_items i on i.id = s.item_id where not i.active")"
before="$("${PSQL[@]}" -c "select string_agg(item_id::text, ',' order by section, slot) from public.store_stock")"
"${PSQL[@]}" -c "select public.store_ensure_stock()" >/dev/null
after="$("${PSQL[@]}" -c "select string_agg(item_id::text, ',' order by section, slot) from public.store_stock")"
expect_value "restocking the same day changes nothing already on the shelf" "$before" "$after"
"${PSQL[@]}" >/dev/null <<'SQL'
insert into public.store_items (work_key, media_type, format, title, artist, year, artwork_url, source_id)
values ('music:new lp:new lp', 'music', 'vinyl', 'New LP', 'New LP', 1970, 'https://example.test/new.jpg', 'lpnew');
select public.store_ensure_stock();
SQL
expect_value "a gap on a shelf is filled later in the day, without moving the rest" "4|1,2,3,4" \
  "$("${PSQL[@]}" -c "select count(*) || '|' || string_agg(slot::text, ',' order by slot) from public.store_stock where day = public.store_today() and section = 'vinyl'")"

# Yesterday's shelves go to the back of the queue tomorrow.
"${PSQL[@]}" >/dev/null <<'SQL'
create temp table today_cd as
  select item_id from public.store_stock where day = public.store_today() and section = 'cd';
update public.store_stock set day = day - 1 where day = public.store_today();
select public.store_ensure_stock();
SQL
expect_value "the 8 CDs not on yesterday's shelf are all on today's" "8" \
  "$("${PSQL[@]}" -c "select count(*) from public.store_stock s where s.day = public.store_today() and s.section = 'cd' and s.item_id not in (select item_id from public.store_stock where day = public.store_today() - 1)")"

# ---------- closed until launch ----------
CD1="$(stocked cd 1)"; CD2="$(stocked cd 2)"; CD3="$(stocked cd 3)"; CD4="$(stocked cd 4)"
CD5="$(stocked cd 5)"; CD6="$(stocked cd 6)"; CD7="$(stocked cd 7)"
expect_error "before any countdown, a member cannot use the crate" "STORE_CLOSED" \
  "$(as_user $A "select public.store_crate_add('$CD1')")"
expect_value "an admin can, before launch" "1" \
  "$(as_user $ADMIN "select (public.store_crate_add('$CD1')->>'inCrate')")"
as_user $ADMIN "select public.store_crate_remove('$CD1')" >/dev/null
"${PSQL[@]}" -c "insert into public.site_settings (key, value) values ('store_launch_at', (now() + interval '3 days')::text)" >/dev/null
expect_error "during the countdown, a member still cannot" "STORE_CLOSED" \
  "$(as_user $A "select public.store_crate_add('$CD1')")"
launch_before="$("${PSQL[@]}" -c "select value from public.site_settings where key = 'store_launch_at'")"
as_user $A "update public.site_settings set value = now()::text where key = 'store_launch_at'" >/dev/null
expect_value "a member cannot move the launch time themselves" "$launch_before" \
  "$("${PSQL[@]}" -c "select value from public.site_settings where key = 'store_launch_at'")"
"${PSQL[@]}" -c "update public.site_settings set value = 'not a date' where key = 'store_launch_at'" >/dev/null
expect_error "a garbled launch time reads as closed, not open" "STORE_CLOSED" \
  "$(as_user $A "select public.store_crate_add('$CD1')")"
"${PSQL[@]}" -c "update public.site_settings set value = (now() - interval '1 second')::text where key = 'store_launch_at'" >/dev/null
expect_value "once the launch time has passed, it opens by itself" "1" \
  "$(as_user $A "select (public.store_crate_add('$CD1')->>'inCrate')")"
expect_error "a banned member cannot shop" "STORE_BANNED" \
  "$(as_user $BANNED "select public.store_crate_add('$CD2')")"
expect_error "signed out, the crate is not callable at all" "permission denied" \
  "$("${PSQL[@]}" -c "set role anon; select public.store_crate_add('$CD2')" 2>&1 | tail -n 1)"
expect_value "signed out, the status still answers" "5|false" \
  "$("${PSQL[@]}" -c "set role anon; select (s->>'remaining') || '|' || (s->>'open') from public.store_status() s")"

# ---------- the crate and the limit ----------
expect_error "the same thing cannot go in the crate twice" "STORE_IN_CRATE" \
  "$(as_user $A "select public.store_crate_add('$CD1')")"
expect_error "something not on today's shelves cannot go in the crate" "STORE_NOT_IN_STOCK" \
  "$(as_user $A "select public.store_crate_add('$(item off)')")"
for x in $CD2 $CD3 $CD4 $CD5; do as_user $A "select public.store_crate_add('$x')" >/dev/null; done
expect_error "a sixth thing in the crate is refused" "STORE_LIMIT" \
  "$(as_user $A "select public.store_crate_add('$CD6')")"
expect_value "checkout takes all five" "5|5|0" \
  "$(as_user $A "select (s->>'checkedOut') || '|' || (s->>'usedToday') || '|' || (s->>'remaining') from public.store_checkout() s")"
expect_value "the crate is empty after checkout" "0" "$(as_user $A "select count(*) from public.store_crate")"
expect_value "the five are owned" "5" "$(as_user $A "select count(*) from public.store_owned")"
expect_error "after five, nothing more today" "STORE_LIMIT" \
  "$(as_user $A "select public.store_crate_add('$CD6')")"
expect_error "an empty crate cannot be checked out" "STORE_EMPTY" \
  "$(as_user $A "select public.store_checkout()")"

# The next UTC day: a fresh allowance, but still nothing owned twice.
"${PSQL[@]}" -c "update public.store_owned set day = day - 1 where user_id = '$A'" >/dev/null
expect_value "the next day, five more are allowed" "5" \
  "$(as_user $A "select public.store_status()->>'remaining'")"
expect_error "but an owned item can never be checked out again" "STORE_OWNED" \
  "$(as_user $A "select public.store_crate_add('$CD1')")"

# Something left in the crate from yesterday does not count, and goes.
"${PSQL[@]}" -c "insert into public.store_crate (user_id, item_id, day) values ('$C', '$CD7', public.store_today() - 1)" >/dev/null
as_user $C "select public.store_crate_add('$CD6')" >/dev/null
expect_value "yesterday's crate is cleared on the next visit" "1|$CD6" \
  "$(as_user $C "select count(*) || '|' || min(item_id::text) from public.store_crate")"

# ---------- members cannot write the tables directly ----------
expect_error "a member cannot insert into what they own" "permission denied" \
  "$(as_user $B "insert into public.store_owned (user_id, item_id, day) values ('$B', '$CD7', public.store_today())")"
expect_error "a member cannot fill their crate past the rules" "permission denied" \
  "$(as_user $B "insert into public.store_crate (user_id, item_id, day) values ('$B', '$CD7', public.store_today())")"
expect_error "a member cannot add to the catalogue" "permission denied" \
  "$(as_user $B "insert into public.store_items (work_key, media_type, format, title, artwork_url, source_id) values ('x', 'music', 'cd', 'x', 'x', 'x')")"
expect_value "a member sees only their own owned items" "0" \
  "$(as_user $B "select count(*) from public.store_owned")"

# ---------- concurrency ----------
# Bob has already taken two home today, so three are left. Twelve
# requests to put twelve different things in his crate arrive at once:
# exactly three may get in.
for x in $(seq 1 2); do
  "${PSQL[@]}" -c "insert into public.store_owned (user_id, item_id, day) select '$B', item_id, public.store_today() from public.store_stock where day = public.store_today() and section = 'dvd' order by slot offset $((x - 1)) limit 1" >/dev/null
done
pids=()
for n in $(seq 3 12); do
  id="$(stocked dvd $n)"
  [ -n "$id" ] || id="$(stocked cd $n)"
  ( as_user $B "select public.store_crate_add('$id')" >"$WORK/add.$n" ) & pids+=($!)
done
for n in $(seq 1 2); do
  id="$(stocked cassette $n)"
  ( as_user $B "select public.store_crate_add('$id')" >"$WORK/add.t$n" ) & pids+=($!)
done
wait "${pids[@]}"
expect_value "twelve simultaneous crate adds with three left: exactly three succeed" "3" \
  "$("${PSQL[@]}" -c "select count(*) from public.store_crate where user_id = '$B'")"

# Two checkouts of that crate at once: one takes it, the other finds it
# empty. Never two sets, never more than five in a day.
( as_user $B "select public.store_checkout()->>'checkedOut'" >"$WORK/co.1" ) &
p1=$!
( as_user $B "select public.store_checkout()->>'checkedOut'" >"$WORK/co.2" ) &
p2=$!
wait $p1 $p2
expect_value "two simultaneous checkouts: one takes three, the other finds the crate empty" "3|STORE_EMPTY" \
  "$(cat "$WORK/co.1" "$WORK/co.2" | sed 's/.*STORE_EMPTY.*/STORE_EMPTY/' | sort | paste -sd'|')"
expect_value "and Bob owns exactly five today" "5" \
  "$("${PSQL[@]}" -c "select count(*) from public.store_owned where user_id = '$B' and day = public.store_today()")"

# Carol tries to beat the limit by checking out from two sessions while
# a third adds to the crate. Whatever the interleaving, five is the most.
"${PSQL[@]}" -c "delete from public.store_crate where user_id = '$C'" >/dev/null
for n in 1 2 3 4; do as_user $C "select public.store_crate_add('$(stocked dvd $((n + 4)))')" >/dev/null; done
pids=()
for n in 1 2 3; do ( as_user $C "select public.store_checkout()" >/dev/null ) & pids+=($!); done
for n in 9 10 11 12; do ( as_user $C "select public.store_crate_add('$(stocked cd $n)')" >/dev/null ) & pids+=($!); done
wait "${pids[@]}"
for n in 1 2; do ( as_user $C "select public.store_checkout()" >/dev/null ) & pids+=($!); done
wait
expect_value "racing checkouts and adds never take a member past five in a day" "t" \
  "$("${PSQL[@]}" -c "select count(*) <= 5 from public.store_owned where user_id = '$C' and day = public.store_today()")"

# ---------- reviews ----------
expect_error "you cannot review from the bedroom what you do not own" "STORE_NOT_OWNED" \
  "$(as_user $B "select public.store_submit_review('$CD1', 4, 'great')")"
POST="$(as_user $A "select public.store_submit_review('$CD1', 4, 'great record')")"
expect_value "a review of something you own is an ordinary review in posts" "music|4|great record|true" \
  "$("${PSQL[@]}" -c "select p.media_type || '|' || p.rating || '|' || p.body || '|' || (p.work_id is not null) from public.posts p where p.id = '$POST'")"
expect_value "and belongs to the work every other review of it belongs to" "1" \
  "$("${PSQL[@]}" -c "select count(*) from public.works w join public.store_items i on i.work_key = w.work_key where i.id = '$CD1'")"
POST2="$(as_user $A "select public.store_submit_review('$CD1', 2, 'changed my mind')")"
expect_value "writing again edits the same review rather than posting another" "$POST|2|changed my mind|1" \
  "$POST2|$("${PSQL[@]}" -c "select p.rating || '|' || p.body || '|' || (select count(*) from public.store_reviews where user_id = '$A') from public.posts p where p.id = '$POST'")"
expect_error "a review needs a rating or some words" "STORE_BAD_REVIEW" \
  "$(as_user $A "select public.store_submit_review('$CD2', null, '   ')")"
expect_error "a rating outside one to five is refused" "STORE_BAD_REVIEW" \
  "$(as_user $A "select public.store_submit_review('$CD2', 9, 'x')")"
expect_error "a review row cannot be forged directly" "permission denied" \
  "$(as_user $B "insert into public.store_reviews (user_id, item_id, post_id) values ('$B', '$CD1', '$POST')")"
DVD_OWNED="$("${PSQL[@]}" -c "select item_id from public.store_owned where user_id = '$B' and item_id in (select id from public.store_items where format = 'dvd') limit 1")"
FILM_POST="$(as_user $B "select public.store_submit_review('$DVD_OWNED', 5, 'a film')")"
expect_value "a film review is a movie_tv post with no artist" "movie_tv|" \
  "$("${PSQL[@]}" -c "select media_type || '|' || coalesce(artist, '') from public.posts where id = '$FILM_POST'")"
"${PSQL[@]}" -c "delete from public.posts where id = '$POST'" >/dev/null
expect_value "deleting the post (moderation) takes it off the board" "0" \
  "$("${PSQL[@]}" -c "select count(*) from public.store_reviews where post_id = '$POST'")"
expect_value "but the item stays owned" "1" \
  "$("${PSQL[@]}" -c "select count(*) from public.store_owned where user_id = '$A' and item_id = '$CD1'")"

echo
if [ "$failures" -gt 0 ]; then
  echo "$failures failed"
  exit 1
fi
echo "all passed"
