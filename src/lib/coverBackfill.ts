import { lookupTrack } from "@/lib/catalogue";
import { coverKeyFor, readCovers, writeCovers } from "@/lib/coverCache";
import type { StorePost } from "@/lib/profileStore";

/**
 * Cover art for reviews that were posted without any.
 *
 * A review carries whatever artwork was attached when it was written,
 * and plenty were written without any: somebody types a song title, says
 * what they think, and posts. That used to be invisible, because the
 * store dropped every cover-less review before it reached a shelf. Now
 * that the store shows every profile, they are visible, and they are
 * visible as a grey square with a letter on it - which is a worse
 * answer than the one the catalogue can give for free.
 *
 * So the ones that are about music get looked up. Apple charges nothing
 * and asks for no key, and lib/itunes holds each answer for an hour, so
 * a profile that has been opened once this hour costs nothing at all.
 *
 * Only music. A photography post has no entry in a record catalogue and
 * a film's artwork is not in one either, so asking would be a request
 * that could only come back empty.
 */

/** How many to look up for one profile render. */
const MAX_LOOKUPS = 18;

/** How many at a time. Apple allows roughly twenty calls a minute. */
const CONCURRENCY = 6;

/**
 * How long the whole backfill gets before the page goes without it.
 *
 * This runs while somebody waits for a profile, so it needs a floor
 * under how bad it can be. Without one, a slow or throttled catalogue
 * turns "your covers are missing" into "your profile will not load",
 * which is a straight trade of a cosmetic problem for a real one.
 *
 * Whatever came back by the deadline is kept - the workers write into
 * the array as they finish, so a timeout keeps the eleven that landed
 * and drops the seven that did not. The rest fall back to the lettered
 * sleeve, and the next view gets them from the hour-long cache.
 */
const DEADLINE_MS = 2500;

export async function backfillCovers<T extends StorePost>(posts: T[]): Promise<T[]> {
  const wanted: number[] = [];
  for (let i = 0; i < posts.length && wanted.length < MAX_LOOKUPS; i++) {
    const post = posts[i];
    if (post.cover_url) continue;
    if (post.media_type && post.media_type !== "music") continue;
    if (!post.title?.trim() || !post.artist?.trim()) continue;
    wanted.push(i);
  }
  if (wanted.length === 0) return posts;

  const out = [...posts];

  // What the site already knows, before anybody troubles a catalogue.
  //
  // track_covers is filled by every shelf, every crate and every post
  // written, and a cover is a cover wherever it was learned - so most of
  // these are answered by one database query costing nothing. That is
  // also what makes this cheap enough for the FEED, which never had it
  // and which is where the blank squares were most visible.
  const keys = wanted.map((i) => coverKeyFor(out[i].title, out[i].artist ?? ""));
  const known = await readCovers([...new Set(keys)]);
  const stillWanted: number[] = [];
  for (let n = 0; n < wanted.length; n++) {
    const hit = known.get(keys[n]);
    if (hit?.artworkUrl) out[wanted[n]] = { ...out[wanted[n]], cover_url: hit.artworkUrl };
    else stillWanted.push(wanted[n]);
  }
  if (stillWanted.length === 0) return out;

  const learned: { key: string; info: Awaited<ReturnType<typeof lookupTrack>> }[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < stillWanted.length) {
      const index = stillWanted[cursor++];
      const post = out[index];
      // Three catalogues rather than one. This asked Apple alone, which
      // is the one that throttles at twenty calls a minute, so on a busy
      // page most of these came back empty and the squares stayed blank.
      //
      // A miss is still a miss: the lettered sleeve remains the right
      // answer for a track nobody has released.
      const info = await lookupTrack(post.title, post.artist ?? "").catch(() => null);
      if (!info) continue;
      if (info.artworkUrl) out[index] = { ...post, cover_url: info.artworkUrl };
      if (!info.throttled) {
        learned.push({ key: coverKeyFor(post.title, post.artist ?? ""), info });
      }
    }
  }
  await Promise.race([
    Promise.all(Array.from({ length: Math.min(CONCURRENCY, stillWanted.length) }, worker)),
    new Promise((resolve) => setTimeout(resolve, DEADLINE_MS)),
  ]);
  // Written down, so the next page that shows any of these - a feed, a
  // profile, a shelf - pays nothing for them at all.
  await writeCovers(learned).catch(() => {});
  return out;
}
