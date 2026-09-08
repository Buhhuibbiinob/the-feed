import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ItunesTrackInfo } from "@/lib/itunes";
import { lookupTrack } from "@/lib/catalogue";
import { coverKeyFor, readCovers, worthRemembering, writeCovers } from "@/lib/coverCache";

/**
 * Art, clips and release years for a handful of sleeves at once.
 *
 * The single sleeve route is right for the crate, where somebody is
 * looking at one record and the next one is a guess. It was badly wrong
 * for a shelf. A shelf of fifty asked for them one at a time, two in
 * flight, with a hundred and sixty millisecond wait between each pair -
 * so twenty five rounds of (sign the request, check the session, route
 * it, ask Apple, wait). Covers appeared over the course of a minute, in
 * dribs, which is exactly what got reported: everything takes far too
 * long to load.
 *
 * Almost none of that minute was Apple. It was the twenty five round
 * trips and the fifty session checks around them. So: one request, one
 * session check, the lookups run together on the server, one answer.
 *
 * The cap is not politeness, it is the point. Apple allows roughly
 * twenty calls a minute and answers 403 above that, so a batch of two
 * hundred would throttle itself and come back empty. The caller asks for
 * what somebody can actually see; a screenful is well inside the limit,
 * and lib/itunes caches for an hour on top of that, so scrolling back up
 * costs nothing.
 */
const MAX_ITEMS = 24;

/**
 * How many UNCACHED lookups are in flight at once.
 *
 * Still low, because Apple allows roughly twenty calls a minute across
 * everything this site does and shelf covers are background work
 * competing with the search box in the post form, which is a person
 * sitting and waiting. Background work should lose that competition.
 *
 * Three rather than two now that the database answers most of a batch:
 * what reaches this pool is the handful nobody has ever looked up, not
 * the whole shelf, so the same ceiling buys a faster shelf without
 * spending more of the budget.
 */
const CONCURRENCY = 3;

/**
 * How long the whole batch gets before it answers with what it has.
 *
 * An obscure shelf misses on nearly every record, and a miss is a real
 * request whatever comes back. Without a ceiling the browser waits on
 * the slowest lookup in the batch - which, once Apple starts throttling,
 * is however long the backoff takes - and the shelf sits there.
 *
 * Whatever arrived by the deadline is sent. The rest are simply not in
 * the answer, and the client leaves those records as blank sleeves,
 * which is the correct picture for a record Apple does not have anyway.
 *
 * Both passes share this one budget rather than getting one each, which
 * is what keeps the deeper second pass honest: on a shelf that is
 * mostly cached the first pass finishes in milliseconds and there is
 * plenty of room to go looking for the stragglers' clips, and on a cold
 * shelf that spends the whole four seconds there is none, so it does
 * not run at all. The shelf never waits longer to be more thorough.
 */
const DEADLINE_MS = 4000;

type Ask = { key: string; title: string; artist: string };

function asks(value: unknown): Ask[] {
  if (!Array.isArray(value)) return [];
  const out: Ask[] = [];
  for (const raw of value.slice(0, MAX_ITEMS)) {
    if (!raw || typeof raw !== "object") continue;
    const { key, title, artist } = raw as Record<string, unknown>;
    if (typeof key !== "string" || typeof title !== "string" || typeof artist !== "string") continue;
    const t = title.trim();
    const a = artist.trim();
    if (!t || !a) continue;
    out.push({ key, title: t, artist: a });
  }
  return out;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nothing to look up." }, { status: 400 });
  }
  const items = asks((body as { items?: unknown })?.items);
  if (items.length === 0) return NextResponse.json({ results: {} });

  const results: Record<string, ItunesTrackInfo> = {};

  // What the site already knows, before anybody troubles Apple.
  //
  // A cover does not change, so the first person to see a record pays for
  // it and everyone after reads it out of the database. On a shelf that
  // has been looked at before this answers the whole batch without a
  // single call to the catalogue, which is what leaves the search box in
  // the post form room to work while the shelves are loading.
  const wanted = items.map((ask) => ({ ...ask, cacheKey: coverKeyFor(ask.title, ask.artist) }));
  const known = await readCovers([...new Set(wanted.map((w) => w.cacheKey))]);

  // Two records in one batch can be the same work under different
  // spellings, so misses are gathered by cache key rather than by ask -
  // otherwise a batch could spend two lookups learning one fact.
  const missing = new Map<string, { title: string; artist: string }>();
  for (const w of wanted) {
    const hit = known.get(w.cacheKey);
    if (hit) results[w.key] = hit;
    else if (!missing.has(w.cacheKey)) missing.set(w.cacheKey, { title: w.title, artist: w.artist });
  }

  const asked = [...missing].map(([cacheKey, ask]) => ({ cacheKey, ...ask }));
  const learned: { key: string; info: ItunesTrackInfo }[] = [];

  /** Everything a shallow search came back empty-handed on. */
  const nothingFound: typeof asked = [];

  const startedAt = Date.now();
  const timeLeft = () => DEADLINE_MS - (Date.now() - startedAt);

  function publish(cacheKey: string, info: ItunesTrackInfo) {
    for (const w of wanted) if (w.cacheKey === cacheKey) results[w.key] = info;
  }

  /**
   * Look up a list, a few at a time, until the deadline.
   *
   * `deep` is the artist-catalogue fallback, which costs two more
   * requests per miss. See below for why it is off in the first pass and
   * on in the second.
   */
  async function pool(list: typeof asked, deep: boolean) {
    let cursor = 0;
    async function worker() {
      while (cursor < list.length) {
        if (timeLeft() <= 0) return;
        const ask = list[cursor++];
        // A sleeve that fails is a sleeve with no art, not a failed
        // batch. One bad lookup must not cost the other twenty three
        // their covers.
        // Two catalogues, not one. Apple knows release years and allows
        // twenty calls a minute; Deezer allows about thirty times that
        // and has most of the same records. The first refusal from Apple
        // sends the rest of the batch straight to Deezer rather than
        // backing off into a wall - see lib/catalogue.
        const info = await lookupTrack(ask.title, ask.artist, { deep }).catch(() => null);
        // A throttled lookup is left OUT of the answer rather than
        // reported as an empty one.
        //
        // Apple answers 403 when asked too often, and lookupItunesTrack
        // hands back the same all-nulls shape for that as for "no such
        // track". Passing it on made the browser cache "this record has
        // no cover" for the life of the tab - and since the shelf now
        // swaps out records it believes are unplayable, a throttled
        // batch could empty a shelf of records that were all perfectly
        // fine. It is not written to the database either, for the same
        // reason and for longer: a busy moment must not become a
        // permanent blank sleeve.
        //
        // Absent from the answer means "ask again". The client leaves
        // those keys unclaimed and picks them up on the next pass.
        if (!info || info.throttled) continue;

        const emptyHanded = !info.artworkUrl && !info.previewUrl;
        publish(ask.cacheKey, info);
        // An empty answer is still sent to the browser, because the
        // shelf uses it to swap that record out for another one - but it
        // is only WRITTEN DOWN when it came from a deep lookup. A
        // shallow miss is not proof Apple has nothing; caching one as
        // fact would make a record that a catalogue search would have
        // found unplayable forever, which is the exact opposite of what
        // the cache is for.
        if (worthRemembering(info, deep)) learned.push({ key: ask.cacheKey, info });
        if (emptyHanded && !deep) nothingFound.push(ask);
      }
    }
    return Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, worker));
  }

  // First pass: one request each, no fallback.
  //
  // A shelf of a genuinely obscure tag misses on nearly everything, and
  // with the fallback on, every miss costs three requests instead of one
  // - twenty four records become about seventy calls against a limit of
  // twenty a minute. That is the shelf that never finishes loading.
  const tails: Promise<unknown>[] = [];
  const first = pool(asked, false);
  tails.push(first);
  await Promise.race([first, new Promise((resolve) => setTimeout(resolve, timeLeft()))]);

  // Second pass: the fallback, for the handful that came back with
  // nothing at all.
  //
  // A record with no cover AND no clip is an inert square: nothing to
  // look at and nothing to press. The catalogue fallback is what finds
  // those, because Apple's search is a relevance search and a slightly
  // differently spelled title misses it while the artist's own catalogue
  // has the track sitting right there.
  //
  // It is affordable now for one reason: the answer is written down. The
  // old objection was that a deep miss costs three requests EVERY time
  // anybody loads that shelf. Now it costs three requests once, ever,
  // and every later view reads it out of the database. So the site pays
  // a few of those per batch, capped and inside the same deadline, and
  // the ones it does not reach this time are picked up on the next pass.
  const DEEP_MAX = 6;
  if (nothingFound.length > 0 && timeLeft() > 700) {
    const second = pool(nothingFound.slice(0, DEEP_MAX), true);
    tails.push(second);
    await Promise.race([second, new Promise((resolve) => setTimeout(resolve, timeLeft()))]);
  }

  // Written down before answering, including the "Apple has nothing"
  // rows: a record the catalogue does not stock is a fact worth keeping,
  // and it is the one that saves the most, because an obscure shelf
  // misses on nearly everything and would otherwise ask again forever.
  //
  // Then again for whatever the deadline outran. Those are the lookups
  // most worth keeping - a shelf slow enough to time out is a shelf that
  // will time out for the next person too, unless what it learned gets
  // written down. splice hands over what has arrived and leaves the array
  // for the still-running workers to fill.
  await writeCovers(learned.splice(0));
  void Promise.allSettled(tails).then(() => writeCovers(learned.splice(0)));

  return NextResponse.json({ results });
}
