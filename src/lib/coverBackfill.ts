import { searchItunesArt } from "@/lib/itunes";
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
  let cursor = 0;
  async function worker() {
    while (cursor < wanted.length) {
      const index = wanted[cursor++];
      const post = out[index];
      // A miss is a miss. The lettered sleeve is still there for
      // anything the catalogue genuinely does not have, which is the
      // right answer for a track nobody has released.
      const art = await searchItunesArt(post.title, post.artist ?? "").catch(() => null);
      if (art) out[index] = { ...post, cover_url: art };
    }
  }
  await Promise.race([
    Promise.all(Array.from({ length: Math.min(CONCURRENCY, wanted.length) }, worker)),
    new Promise((resolve) => setTimeout(resolve, DEADLINE_MS)),
  ]);
  return out;
}
