import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { YoutubeVideo } from "@/lib/youtube";

// The day's hundred searches, spent on purpose.
//
// YouTube allows 10,000 units a day and a search costs 100, so the whole
// site gets a hundred of them between everybody. That is a real ceiling
// and it was being hit by pages refreshing themselves: every distinct
// film shelf is a search, the Feed TV fills itself with up to four, the
// Discover rails try three lanes. None of that is anybody pressing
// anything, and when the allowance ran out at four in the afternoon the
// thing that stopped working was somebody pressing play.
//
// Two changes, and the first one matters more than the second.
//
// REMEMBERING IT PROPERLY. The results were cached in the deployment,
// which meant every push to the site threw the whole day's answers away
// and the next visitor paid for all of them again. They live in the
// database now: shared by everybody, across deploys, and readable back
// tomorrow. A shelf costs one search when it is first looked at and
// nothing after that until it is deliberately refreshed.
//
// SPENDING IT IN AN ORDER. Background refreshes get most of the day's
// allowance and no more. What is left is kept for the things a person is
// waiting on - pressing play on a record with no clip, resolving a song
// they just picked. So a heavy day degrades by shelves going stale
// rather than by play buttons dying, which is the right way round: a
// day-old shelf is fine and a dead play button is the site not working.
//
// And when there is nothing left, a stale answer is served rather than
// none. Yesterday's shelf is a shelf.

/** What Google gives a project a day, and what one search costs. */
export const DAILY_UNITS = 10_000;
export const SEARCH_UNITS = 100;

/**
 * How much of the day background work may spend.
 *
 * The remainder is not spare, it is reserved: it is what the play button
 * spends at nine in the evening after the shelves have had all day to
 * refresh themselves.
 */
export const BACKGROUND_SHARE = 0.7;

/** Who is waiting on this search. */
export type SearchPriority = "background" | "user";

export function budgetFor(priority: SearchPriority): number {
  return priority === "user" ? DAILY_UNITS : Math.floor(DAILY_UNITS * BACKGROUND_SHARE);
}

export function cacheKey(query: string, limit: number, options: Record<string, unknown>): string {
  const shape = JSON.stringify({ query, limit, ...options });
  return createHash("sha256").update(shape).digest("hex").slice(0, 40);
}

export type CachedSearch = { videos: YoutubeVideo[]; ageSeconds: number };

/**
 * What YouTube said last time, if anybody has ever asked this.
 *
 * Returns the age as well as the answer, so the caller can decide
 * whether it is fresh enough - and, when the allowance is gone, decide
 * to use it anyway.
 */
export async function readSearch(key: string): Promise<CachedSearch | null> {
  try {
    const { data, error } = await createAdminClient()
      .from("youtube_searches")
      .select("payload, fetched_at")
      .eq("query_key", key)
      .maybeSingle<{ payload: YoutubeVideo[]; fetched_at: string }>();
    if (error || !data) return null;
    const ageSeconds = (Date.now() - new Date(data.fetched_at).getTime()) / 1000;
    return { videos: Array.isArray(data.payload) ? data.payload : [], ageSeconds };
  } catch {
    // No service key, or migration 018 has not been run. The site works
    // exactly as it did before: it asks YouTube.
    return null;
  }
}

export async function writeSearch(
  key: string,
  query: string,
  videos: YoutubeVideo[]
): Promise<void> {
  // An empty answer is not written down. A search that came back with
  // nothing is usually a search that failed in a way this cannot see,
  // and caching it would keep a shelf empty for as long as the row
  // lived - which is the same mistake as caching a throttle.
  if (videos.length === 0) return;
  try {
    await createAdminClient()
      .from("youtube_searches")
      .upsert(
        { query_key: key, query, payload: videos, fetched_at: new Date().toISOString() },
        { onConflict: "query_key" }
      );
  } catch {
    // Best effort, same as the cover cache.
  }
}

/** Units spent today, as far as anybody knows. */
export async function unitsSpentToday(): Promise<number> {
  try {
    const { data, error } = await createAdminClient()
      .from("youtube_usage")
      .select("units")
      .eq("day", new Date().toISOString().slice(0, 10))
      .maybeSingle<{ units: number }>();
    if (error || !data) return 0;
    return data.units ?? 0;
  } catch {
    // Unknown is treated as nothing spent. Being unable to count is not
    // a reason to stop working - Google enforces the real limit anyway,
    // and this ledger exists to spend it in a sensible ORDER rather than
    // to be the thing that prevents an overrun.
    return 0;
  }
}

/** Records a search against today, atomically. */
export async function spendUnits(amount = SEARCH_UNITS): Promise<void> {
  try {
    await createAdminClient().rpc("spend_youtube_units", { amount });
  } catch {
    // If it cannot be recorded it cannot be counted, which means
    // background work gets a little more rope than it should. Better
    // than refusing to search because the ledger is unavailable.
  }
}

/** Whether this search is allowed to cost anything right now. */
export async function canSpend(priority: SearchPriority): Promise<boolean> {
  const spent = await unitsSpentToday();
  return spent + SEARCH_UNITS <= budgetFor(priority);
}
