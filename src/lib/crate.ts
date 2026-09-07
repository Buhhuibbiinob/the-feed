import {
  DISCOVERY_TAGS,
  MUSIC_ERAS,
  excludeHits,
  getTracksByTag,
  getTracksForEra,
  type LastfmTrack,
} from "@/lib/lastfm";
import { workKey } from "@/lib/taste";
import type { Find, Known } from "@/lib/musicDiscovery";

// Digging, rather than being recommended to.
//
// The rails on Discover are an algorithm: they start from what somebody
// rated highly and walk outward, and every card explains itself with
// "because you liked X". That is the good version of a recommender, and
// it is still a recommender - it can only ever hand back the
// neighbourhood of what you already are.
//
// A crate does not know you. You pull out one sleeve at a time, in
// whatever order the last person left them in, and most of them are not
// for you. That is not a failure of the crate; it is the mechanism. The
// one in thirty that stops you is worth more than thirty ranked
// suggestions precisely because nothing arranged it.
//
// So this deliberately does NOT read anybody's taste. The only thing it
// knows about the person digging is what they have already reviewed, and
// it uses that solely to take those records out - a crate you have
// already been through is not a crate.

/** A sleeve in the crate. Same shape as a Find, minus the reasoning. */
export type Sleeve = Omit<Find, "becauseOf"> & {
  /**
   * What kind of thing this is.
   *
   * A crate in a shop is not sorted by medium. There are films in the
   * box, and the moment you hit one it is a different decision from the
   * record before it, which is most of why digging through one is worth
   * doing at all. Optional so every existing caller keeps working and
   * anything without it is a record, which everything was.
   */
  kind?: "record" | "film";
  /** For a film: the trailer, which is that object's version of a clip. */
  videoId?: string;
};

/**
 * One record for every this many films.
 *
 * Films are the surprise in the box, not half of it. One in six is often
 * enough that you know they are in there and rare enough that hitting one
 * still registers.
 */
export const FILMS_PER_CRATE = 5;

/**
 * Films dropped into a crate of records, evenly but not on a beat.
 *
 * Spaced by division rather than shuffled in: a shuffle clumps, and two
 * films back to back in a box of thirty reads as a bug rather than as
 * chance. The offset moves with the seed so they are not in the same
 * slots every visit.
 */
export function mixInFilms(records: Sleeve[], films: Sleeve[], seed: number): Sleeve[] {
  if (films.length === 0) return records;
  const out: Sleeve[] = [];
  const gap = Math.max(2, Math.floor(records.length / (films.length + 1)));
  const offset = Math.abs(seed) % gap;
  let next = 0;
  records.forEach((record, i) => {
    out.push(record);
    if (next < films.length && i >= offset && (i - offset) % gap === gap - 1) {
      out.push(films[next++]);
    }
  });
  // Anything that did not fit goes on the end rather than being dropped.
  return [...out, ...films.slice(next)];
}

/** How many sleeves one visit gets. Enough to dig, few enough to finish. */
export const CRATE_SIZE = 30;

/** Scene tags to pull from at once. The rails use one a day; a crate is
 *  supposed to be jumbled, so it takes a handful and mixes them. */
const TAGS_PER_CRATE = 6;
const TRACKS_PER_TAG = 25;

/**
 * A shuffle you can reproduce.
 *
 * Math.random would reshuffle on every render, so the sleeve under your
 * hand would change while you were looking at it. Seeding it means the
 * order holds still for a visit and is different on the next one - which
 * is also what a real crate does, since somebody else has been through it
 * since you were last here.
 */
export function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const out = [...items];
  // A small xorshift. Not cryptography - just a repeatable sequence that
  // doesn't visibly cycle over thirty items the way `seed * i % n` does.
  let state = (seed | 0) || 1;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return Math.abs(state);
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = next() % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Everything the crate holds, jumbled and with the known records pulled.
 *
 * Deliberately unranked. The pool is flattened before it is shuffled, so
 * a track from a decade chart and a track from a scene tag are equally
 * likely to be the next sleeve - there is no ordering to read into.
 */
export function fillCrate(
  pools: LastfmTrack[][],
  known: Known,
  { size = CRATE_SIZE, seed = 1 }: { size?: number; seed?: number } = {}
): Sleeve[] {
  const seen = new Set<string>();
  const sleeves: Sleeve[] = [];

  for (const track of pools.flat()) {
    if (!track.name || !track.artist) continue;
    const key = workKey(track.name, track.artist);
    if (seen.has(key) || known.works.has(key)) continue;
    seen.add(key);
    sleeves.push({
      key,
      name: track.name,
      artist: track.artist,
      imageUrl: track.imageUrl,
      previewUrl: null,
      storeUrl: null,
    });
  }

  return shuffleWithSeed(sleeves, seed).slice(0, size);
}

/**
 * The pools to fill a crate from.
 *
 * Six scenes and two decades, picked by the seed rather than by the day,
 * so two people digging on the same afternoon are not going through the
 * same box. Hits are dropped from each pool before they are mixed: a
 * crate of records everybody owns is a shop, not a crate.
 */
export async function crateSources(seed: number): Promise<LastfmTrack[][]> {
  const tags = shuffleWithSeed([...DISCOVERY_TAGS], seed).slice(0, TAGS_PER_CRATE);
  const decades = shuffleWithSeed(
    MUSIC_ERAS.filter((era) => era.tag !== null).map((era) => era.id),
    seed + 1
  ).slice(0, 2);

  const pools = await Promise.all([
    ...tags.map((tag) => getTracksByTag(tag, TRACKS_PER_TAG).catch(() => [])),
    ...decades.map((era) => getTracksForEra(era, TRACKS_PER_TAG).catch(() => [])),
  ]);

  // Skipping the front of each list as well as filtering by listeners:
  // the top of a tag chart is that scene's greatest hits, which is the
  // one part of it somebody digging has already heard.
  return pools.map((pool) => {
    const deep = excludeHits(pool.slice(4));
    return deep.length > 0 ? deep : excludeHits(pool);
  });
}

/**
 * A seed for one visit.
 *
 * Coarser than a timestamp so a refresh within a minute gives the same
 * crate - otherwise the back button loses your place - and different
 * enough between visits that the box has been re-sorted when you come
 * back. The viewer's id is mixed in so two people digging at the same
 * moment get different boxes.
 */
export function crateSeed(now: Date, viewerId: string | null): number {
  const minute = Math.floor(now.getTime() / 60_000);
  let hash = minute;
  for (const char of viewerId ?? "") {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return hash || 1;
}
