import { lookupItunesTrack } from "@/lib/itunes";
import {
  DISCOVERY_TAGS,
  MUSIC_ERAS,
  SEED_ARTISTS,
  excludeHits,
  getArtistTopTracks,
  getSimilarArtists,
  getTracksByTag,
  getTracksForEra,
  type LastfmTrack,
  type MusicEraId,
} from "@/lib/lastfm";
import { workKey } from "@/lib/taste";

// Finding new music, for members rather than for bots.
//
// The site already had a discovery engine - Last.fm's similar-artist graph,
// its scene tags, its decade charts - and every bit of it was wired to
// src/app/actions/bots.ts. Bots discovered music. People got "For You",
// which is other members' reviews, on a site with thirteen members. On a
// quiet week that page is empty, and an empty recommendations page teaches
// somebody there is nothing here to find.
//
// So this walks the same graph on behalf of the person reading. It starts
// from what they rated highly, steps one artist sideways, and skips the
// tracks they'd already be able to hum. Everything it returns is something
// the site does not contain yet - which is the point. A review of it is a
// review nobody here has written.

/** One thing worth listening to, with the reason it was chosen. */
export type Find = {
  /** Stable across rails and renders: the same key taste.ts uses. */
  key: string;
  name: string;
  artist: string;
  imageUrl: string | null;
  /** Apple's 30-second clip, when the catalogue has one. */
  previewUrl: string | null;
  storeUrl: string | null;
  /**
   * The artist whose neighbourhood produced this, so a card can say why
   * it is here. Null on the scene and decade rails, where the reason is
   * the rail's own title.
   */
  becauseOf: string | null;
};

type Candidate = LastfmTrack & { becauseOf: string | null };

/** What somebody has already reviewed - the things a find must not be. */
export type Known = { works: Set<string>; artists: Set<string> };

export type SeedPost = {
  media_type?: string | null;
  title: string;
  artist: string | null;
  rating: number | null;
};

function squashArtist(name: string): string {
  return name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/**
 * Artists to walk out from: the ones this person rated four or five.
 *
 * A three-star review is not a signal to find more of that. If they have
 * rated nothing highly yet, any music they have written about at all is
 * still better evidence than a stranger's list, so that is the second
 * choice; SEED_ARTISTS is only the third.
 */
export function seedArtists(posts: SeedPost[], limit = 5): string[] {
  const music = posts.filter(
    (p) => (p.media_type ?? "music") === "music" && p.artist && p.artist.trim()
  );
  const pickFrom = (rows: SeedPost[]) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const row of rows) {
      const artist = row.artist!.trim();
      const key = squashArtist(artist);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(artist);
      if (out.length >= limit) break;
    }
    return out;
  };

  const loved = pickFrom(music.filter((p) => (p.rating ?? 0) >= 4));
  if (loved.length > 0) return loved;
  return pickFrom(music);
}

/** Everything this person has already written about. */
export function alreadyKnown(posts: SeedPost[]): Known {
  const works = new Set<string>();
  const artists = new Set<string>();
  for (const post of posts) {
    if (post.title) works.add(workKey(post.title, post.artist));
    if (post.artist?.trim()) artists.add(squashArtist(post.artist));
  }
  return { works, artists };
}

export const NOTHING_KNOWN: Known = { works: new Set(), artists: new Set() };

/**
 * Which day it is, as a number. Discovery rotates on this rather than on
 * Math.random so that a page holds still while somebody is reading it and
 * is different tomorrow - the same trick profileOfTheWeek uses.
 */
export function dayIndex(now: Date = new Date()): number {
  return Math.floor(now.getTime() / 86_400_000);
}

/** The list, starting from a different place each day. */
export function rotate<T>(items: T[], by: number): T[] {
  if (items.length === 0) return [];
  const offset = ((by % items.length) + items.length) % items.length;
  return [...items.slice(offset), ...items.slice(0, offset)];
}

/**
 * Turns raw candidates into the row that gets shown.
 *
 * Two rules do most of the work. Anything the member has already reviewed
 * is dropped, artist included - being recommended a record you wrote about
 * last week is the thing that makes a recommender feel broken. And the
 * results are interleaved by which seed produced them, so five tracks by
 * one neighbour of one artist can't take the whole row: you get one from
 * each direction before you get a second from any.
 */
export function rankFinds(candidates: Candidate[], known: Known, limit: number): Find[] {
  const groups = new Map<string, Find[]>();
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (!candidate.name || !candidate.artist) continue;
    const key = workKey(candidate.name, candidate.artist);
    if (seen.has(key) || known.works.has(key)) continue;
    if (known.artists.has(squashArtist(candidate.artist))) continue;
    seen.add(key);

    const groupKey = candidate.becauseOf ?? "";
    const find: Find = {
      key,
      name: candidate.name,
      artist: candidate.artist,
      imageUrl: candidate.imageUrl,
      previewUrl: null,
      storeUrl: null,
      becauseOf: candidate.becauseOf,
    };
    const group = groups.get(groupKey);
    if (group) group.push(find);
    else groups.set(groupKey, [find]);
  }

  const lists = [...groups.values()];
  const out: Find[] = [];
  for (let round = 0; out.length < limit; round++) {
    let took = false;
    for (const list of lists) {
      if (round >= list.length) continue;
      out.push(list[round]);
      took = true;
      if (out.length >= limit) break;
    }
    if (!took) break;
  }
  return out;
}

// How far past an artist's most-played tracks to start. Their number one
// is the one everybody already knows; the interesting half of a catalogue
// starts a few places down.
const SKIP_TOP_TRACKS = 2;
const TRACKS_PER_ARTIST = 4;
const NEIGHBOURS_PER_SEED = 2;

/** An artist's catalogue past the hits, as candidates credited to a seed. */
async function candidatesFromArtist(artist: string, becauseOf: string): Promise<Candidate[]> {
  const tracks = await getArtistTopTracks(artist, 30).catch(() => []);
  if (tracks.length === 0) return [];
  const deep = excludeHits(tracks.slice(SKIP_TOP_TRACKS));
  const from = deep.length > 0 ? deep : excludeHits(tracks);
  return from.slice(0, TRACKS_PER_ARTIST).map((track) => ({ ...track, becauseOf }));
}

/**
 * The personal rail: for each artist they love, two artists Last.fm
 * considers adjacent, and a few tracks from each.
 *
 * Which two neighbours rotates daily, so the rail is not the same eight
 * songs for as long as somebody's taste holds still.
 */
export async function findsForSeeds(
  seeds: string[],
  known: Known,
  { limit = 8, now = new Date() }: { limit?: number; now?: Date } = {}
): Promise<Find[]> {
  if (seeds.length === 0) return [];
  const day = dayIndex(now);

  const perSeed = await Promise.all(
    seeds.map(async (seed) => {
      const similar = await getSimilarArtists(seed, 20).catch(() => []);
      const neighbours = rotate(similar, day).slice(0, NEIGHBOURS_PER_SEED);
      // No neighbours means Last.fm has never heard of them - their own
      // deep cuts are still a better answer than dropping the seed.
      const artists = neighbours.length > 0 ? neighbours : [seed];
      const lists = await Promise.all(artists.map((a) => candidatesFromArtist(a, seed)));
      return lists.flat();
    })
  );

  return rankFinds(perSeed.flat(), known, limit);
}

/** The scene of the day, and the tracks in it that aren't its hits. */
export async function sceneFinds(
  known: Known,
  { limit = 6, now = new Date() }: { limit?: number; now?: Date } = {}
): Promise<{ tag: string; finds: Find[] }> {
  const tag = rotate(DISCOVERY_TAGS, dayIndex(now))[0];
  const tracks = await getTracksByTag(tag, 50).catch(() => []);
  const deep = excludeHits(tracks.slice(5));
  const from = deep.length >= limit ? deep : excludeHits(tracks);
  return {
    tag,
    finds: rankFinds(
      from.map((track) => ({ ...track, becauseOf: null })),
      known,
      limit
    ),
  };
}

/** The decade of the day, past the songs everybody can already hum. */
export async function eraFinds(
  known: Known,
  { limit = 6, now = new Date() }: { limit?: number; now?: Date } = {}
): Promise<{ era: MusicEraId; label: string; finds: Find[] }> {
  // "Right now" is the live chart, which is the opposite of a deep cut,
  // so the decade rail only draws from the decades.
  const decades = MUSIC_ERAS.filter((e) => e.tag !== null);
  const era = rotate([...decades], dayIndex(now))[0];
  const tracks = await getTracksForEra(era.id, 50).catch(() => []);
  const deep = excludeHits(tracks.slice(5));
  const from = deep.length >= limit ? deep : excludeHits(tracks);
  return {
    era: era.id,
    label: era.label,
    finds: rankFinds(
      from.map((track) => ({ ...track, becauseOf: null })),
      known,
      limit
    ),
  };
}

// Apple's search endpoint has no key and no published quota, but it does
// rate-limit a burst from one address. Enrichment therefore goes a few at
// a time rather than all at once - three rails firing twenty parallel
// lookups is exactly the shape that gets throttled.
const LOOKUP_CONCURRENCY = 4;

/**
 * Fills in artwork and the preview clip.
 *
 * A find with no preview is still shown. Half the value of this page is
 * hearing the thing immediately, but the other half is knowing it exists,
 * and the catalogue simply has no clip for some records.
 */
export async function enrichFinds(finds: Find[]): Promise<Find[]> {
  const out = [...finds];
  let cursor = 0;

  async function worker() {
    while (cursor < out.length) {
      const index = cursor++;
      const find = out[index];
      const info = await lookupItunesTrack(find.name, find.artist).catch(() => null);
      if (!info) continue;
      out[index] = {
        ...find,
        imageUrl: find.imageUrl ?? info.artworkUrl,
        previewUrl: info.previewUrl,
        storeUrl: info.trackUrl,
      };
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(LOOKUP_CONCURRENCY, out.length) }, () => worker())
  );
  return out;
}

/** Community taste, for members who haven't rated anything yet. */
export function communitySeeds(posts: SeedPost[], limit = 5): string[] {
  const loved = seedArtists(posts, limit);
  if (loved.length > 0) return loved;
  return rotate([...SEED_ARTISTS], dayIndex()).slice(0, limit);
}

/**
 * Why a rail came back empty, so the page can say so.
 *
 * Every Last.fm helper answers a missing key and a failed request the same
 * way - an empty array - which renders as "nothing to see", the most
 * misleading thing a page can say about a configuration problem. This
 * makes the difference visible.
 */
export type DiscoveryStatus = "ok" | "not-configured" | "unavailable";

export function discoveryStatus(railCounts: number[]): DiscoveryStatus {
  if (!process.env.LASTFM_API_KEY) return "not-configured";
  return railCounts.some((n) => n > 0) ? "ok" : "unavailable";
}

export function describeDiscoveryStatus(status: DiscoveryStatus): string {
  switch (status) {
    case "not-configured":
      return "Music discovery isn't switched on yet - LASTFM_API_KEY is missing.";
    case "unavailable":
      return "Couldn't reach Last.fm just now. The picks come back as soon as it does.";
    default:
      return "";
  }
}
