import { createAdminClient } from "@/lib/supabase/admin";
import type { ItunesTrackInfo } from "@/lib/itunes";
import { workKey } from "@/lib/taste";

/**
 * What the site already knows about a record's cover.
 *
 * Apple allows roughly twenty calls a minute across everything here, and
 * that budget was being spent asking the same questions repeatedly:
 * every shelf view, for every visitor, looked up covers somebody else
 * had fetched an hour before. Nothing was remembered between people or
 * between page loads beyond one browser tab. That is why the search box
 * in the post form kept being told the catalogue was busy - the shelves
 * were the ones making it busy.
 *
 * A cover does not change, so it is written down. After the first person
 * sees a record, every shelf that shows it again is a database read
 * rather than a call to Apple, and the interactive search has the
 * catalogue to itself.
 *
 * A row that says "we looked and there is nothing" is as valuable as one
 * with a picture in it: it stops the next fifty views asking again about
 * a record Apple does not stock. So the presence of the row is the fact,
 * and every column in it is allowed to be null.
 *
 * Written with the service-role client. A shared cache that any signed
 * in person could write to is one that a single person can vandalise for
 * everybody, so the table has no insert policy at all and writes come
 * from the server.
 */

export type CoverKey = { key: string; title: string; artist: string };

/**
 * Whether an answer is worth writing down for everybody.
 *
 * Three cases and they are not the same fact:
 *
 *  - Apple refused (throttled). Not a fact about the record at all.
 *    Writing it would bake one busy moment into a permanent blank
 *    sleeve, which is the failure this whole area keeps having.
 *  - Apple answered with something. Always worth keeping.
 *  - Apple answered with nothing. Worth keeping ONLY if we asked
 *    properly - a plain search is a relevance search and misses a track
 *    the artist's own catalogue has sitting right there, so caching a
 *    shallow miss as "Apple has nothing" would make a playable record
 *    unplayable forever.
 */
export function worthRemembering(info: ItunesTrackInfo, deep: boolean): boolean {
  if (info.throttled) return false;
  if (info.artworkUrl || info.previewUrl) return true;
  return deep;
}

type Row = {
  work_key: string;
  artwork_url: string | null;
  preview_url: string | null;
  track_url: string | null;
  release_year: number | null;
};

/** The site's own key for a work, so two spellings land on one row. */
export function coverKeyFor(title: string, artist: string): string {
  return workKey(title, artist);
}

function toInfo(row: Row): ItunesTrackInfo {
  return {
    artworkUrl: row.artwork_url,
    previewUrl: row.preview_url,
    trackUrl: row.track_url,
    year: row.release_year,
  };
}

/**
 * Everything already known, in one query.
 *
 * Missing rows are simply absent from the map: the caller asks Apple for
 * those and nothing else. A failure here returns an empty map, which
 * costs some Apple calls and is never wrong - the cache is an
 * optimisation and must not be able to break the feature it speeds up,
 * including on a database where migration 015 has not been run.
 */
export async function readCovers(keys: string[]): Promise<Map<string, ItunesTrackInfo>> {
  const out = new Map<string, ItunesTrackInfo>();
  if (keys.length === 0) return out;
  try {
    const { data, error } = await createAdminClient()
      .from("track_covers")
      .select("work_key, artwork_url, preview_url, track_url, release_year")
      .in("work_key", keys)
      .returns<Row[]>();
    if (error || !data) return out;
    for (const row of data) out.set(row.work_key, toInfo(row));
  } catch {
    // No service key, or no table yet. Ask Apple, same as before.
  }
  return out;
}

/**
 * Remember what Apple said.
 *
 * Only for lookups that got an answer. A throttled one is not written
 * down, because "Apple would not talk to us just then" is not a fact
 * about the record - writing it would bake one busy moment into a
 * permanent blank sleeve for everybody, which is the exact failure this
 * whole area keeps having.
 */
export async function writeCovers(
  entries: { key: string; info: ItunesTrackInfo }[]
): Promise<void> {
  const rows = entries
    .filter(({ info }) => !info.throttled)
    .map(({ key, info }) => ({
      work_key: key,
      artwork_url: info.artworkUrl,
      preview_url: info.previewUrl,
      track_url: info.trackUrl,
      release_year: info.year ?? null,
      updated_at: new Date().toISOString(),
    }));
  if (rows.length === 0) return;
  try {
    await createAdminClient().from("track_covers").upsert(rows, { onConflict: "work_key" });
  } catch {
    // Writing the cache is best effort. The answer is already on its way
    // to whoever asked.
  }
}
