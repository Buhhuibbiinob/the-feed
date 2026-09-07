import { lookupItunesTrack } from "@/lib/itunes";
import {
  DISCOVERY_TAGS,
  MUSIC_ERAS,
  SEED_ARTISTS,
  cleanArtistName,
  excludeHits,
  getArtistTopTracks,
  getDeepTracksByTag,
  getSimilarArtists,
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
  genre?: string | null;
};

/**
 * The styles somebody keeps rating four and five.
 *
 * Artists say who you already listen to; genre says what DIRECTION you
 * lean, which is the thing that survives when the artist list runs out.
 * Somebody with three five-star shoegaze reviews wants more shoegaze,
 * and no similar-artist walk from three artists says that as plainly as
 * the genre they picked three times.
 *
 * Ordered by how often it was rated highly, so a style reviewed once is
 * not treated as a taste.
 */
export function lovedGenres(posts: SeedPost[], limit = 3): string[] {
  const tally = new Map<string, number>();
  for (const post of posts) {
    if ((post.media_type ?? "music") !== "music") continue;
    if ((post.rating ?? 0) < 4 || !post.genre) continue;
    tally.set(post.genre, (tally.get(post.genre) ?? 0) + 1);
  }
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([genre]) => genre)
    .slice(0, limit);
}

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
      // Cleaned first. Reviews posted before song search moved to Apple
      // stored YouTube's channel name, so the artist is often
      // "TLCVEVO" or "Ne-Yo - Topic" - which seeds nothing useful, says
      // "Because you liked TLCVEVO" on the card, and finds no artwork.
      const artist = cleanArtistName(row.artist);
      if (!artist) continue;
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
    const artist = cleanArtistName(post.artist);
    if (artist) artists.add(squashArtist(artist));
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

/**
 * A fresh number for each page load.
 *
 * The rails used to rotate on the day, so refreshing Discover gave you
 * the same eight records until midnight - which reads as a page that has
 * not noticed you came back. The Crate holds still on purpose (you are
 * part-way through a box, and the back button has to return you to it);
 * Discover is the opposite, a shelf you are meant to be able to shake.
 *
 * Random rather than a counter because there is nothing to count on a
 * server that renders each request independently, and nothing here needs
 * to be reproducible.
 */
export function shuffleSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
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
/**
 * How many tracks by one artist a single rail may show.
 *
 * Two. A tag chart is full of the same handful of names - a shoegaze
 * shelf came back four Slowdive, four My Bloody Valentine and five Have
 * a Nice Life out of twenty four - and a rail that is really three
 * artists is not a rail, it is three artists. The cap costs nothing when
 * the pool is varied and does all the work when it is not.
 */
export const MAX_PER_ARTIST = 2;

export function rankFinds(candidates: Candidate[], known: Known, limit: number): Find[] {
  const groups = new Map<string, Find[]>();
  const seen = new Set<string>();
  const perArtist = new Map<string, number>();

  for (const candidate of candidates) {
    if (!candidate.name || !candidate.artist) continue;
    const key = workKey(candidate.name, candidate.artist);
    if (seen.has(key) || known.works.has(key)) continue;
    if (known.artists.has(squashArtist(candidate.artist))) continue;
    const artistKey = squashArtist(candidate.artist);
    const already = perArtist.get(artistKey) ?? 0;
    if (already >= MAX_PER_ARTIST) continue;
    perArtist.set(artistKey, already + 1);
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
async function candidatesFromArtist(
  artist: string,
  becauseOf: string,
  rotateBy = 0
): Promise<Candidate[]> {
  const tracks = await getArtistTopTracks(artist, 30).catch(() => []);
  if (tracks.length === 0) return [];
  const deep = excludeHits(tracks.slice(SKIP_TOP_TRACKS));
  const from = deep.length > 0 ? deep : excludeHits(tracks);
  // Rotated, not sliced from the front. Choosing different NEIGHBOURS
  // was not enough on its own: each neighbour then handed back the same
  // first four tracks every time, so a refresh moved one card and left
  // the rest of the row exactly where it was.
  return rotate(from, rotateBy).slice(0, TRACKS_PER_ARTIST).map((track) => ({ ...track, becauseOf }));
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
  { limit = 8, rotateBy }: { limit?: number; rotateBy?: number } = {}
): Promise<Find[]> {
  if (seeds.length === 0) return [];
  // A different slice of each artist's neighbours every time the page is
  // loaded, rather than once a day.
  const day = rotateBy ?? shuffleSeed();

  const perSeed = await Promise.all(
    seeds.map(async (seed) => {
      const similar = await getSimilarArtists(seed, 20).catch(() => []);
      const neighbours = rotate(similar, day).slice(0, NEIGHBOURS_PER_SEED);
      // No neighbours means Last.fm has never heard of them - their own
      // deep cuts are still a better answer than dropping the seed.
      const artists = neighbours.length > 0 ? neighbours : [seed];
      const lists = await Promise.all(
        // A different offset per artist, so two neighbours of the same
        // seed do not both jump to the same place in their catalogues.
        artists.map((a, i) => candidatesFromArtist(a, seed, day + i * 7))
      );
      return lists.flat();
    })
  );

  return rankFinds(perSeed.flat(), known, limit);
}

/**
 * A scene they keep rating highly, deep.
 *
 * The taste-shaped half of the scene rail: rather than the tag of the
 * day, the style this person has given four and five stars to most
 * often. Falls back to the day's scene when they have not rated enough
 * for it to mean anything - one five-star review is not a direction.
 */
export async function lovedSceneFinds(
  posts: SeedPost[],
  known: Known,
  { limit = 6, rotateBy }: { limit?: number; rotateBy?: number } = {}
): Promise<{ tag: string; fromTaste: boolean; finds: Find[] }> {
  const loved = lovedGenres(posts);
  if (loved.length === 0) {
    const scene = await sceneFinds(known, { limit, rotateBy });
    return { tag: scene.tag, fromTaste: false, finds: scene.finds };
  }
  // Rotated so somebody with three loved styles moves between all three
  // as they refresh, rather than being stuck on one.
  const tag = rotate(loved, rotateBy ?? shuffleSeed())[0];
  const tracks = await getDeepTracksByTag(tag, 50).catch(() => []);
  const from = rotate(excludeHits(tracks), rotateBy ?? shuffleSeed());
  return {
    tag,
    fromTaste: true,
    finds: rankFinds(from.map((track) => ({ ...track, becauseOf: null })), known, limit),
  };
}

/** The scene of the day, and the tracks in it that aren't its hits. */
export async function sceneFinds(
  known: Known,
  { limit = 6, rotateBy }: { limit?: number; rotateBy?: number } = {}
): Promise<{ tag: string; finds: Find[] }> {
  const spin = rotateBy ?? shuffleSeed();
  const tag = rotate(DISCOVERY_TAGS, spin)[0];
  const tracks = await getDeepTracksByTag(tag, 50).catch(() => []);
  const deep = excludeHits(tracks);
  const from = rotate(deep.length >= limit ? deep : excludeHits(tracks), spin);
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
  { limit = 6, rotateBy }: { limit?: number; rotateBy?: number } = {}
): Promise<{ era: MusicEraId; label: string; finds: Find[] }> {
  // "Right now" is the live chart, which is the opposite of a deep cut,
  // so the decade rail only draws from the decades.
  const decades = MUSIC_ERAS.filter((e) => e.tag !== null);
  const spin = rotateBy ?? shuffleSeed();
  const era = rotate([...decades], spin)[0];
  // The decade tag, deep. Page one of "90s" is the twenty songs everybody
  // can hum, which is how Britney and Ace of Base ended up on a shelf
  // headed "Not the songs from the adverts".
  const tracks = await getDeepTracksByTag(era.tag as string, 50).catch(() => []);
  const deep = excludeHits(tracks);
  const from = rotate(deep.length >= limit ? deep : excludeHits(tracks), spin);
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
/**
 * Apple's catalogue, tried more than once.
 *
 * Some cards had no artwork and no play button, and the reason was the
 * name rather than the catalogue: "TheFugeesVEVO" matches nothing, and
 * neither does "Helmet (Official Video)". So the artist is cleaned, and
 * a title carrying video furniture is tried again without it.
 */
async function lookupFind(find: Find) {
  const artist = cleanArtistName(find.artist) ?? find.artist;
  const first = await lookupItunesTrack(find.name, artist);
  if (first.previewUrl || first.artworkUrl) return first;

  // "Song (Official Video)", "Song [Official Audio]", "Artist - Song".
  const bare = find.name
    .replace(/[([][^)\]]*(?:official|video|audio|lyric|hd|remaster)[^)\]]*[)\]]/gi, "")
    .replace(/^.*?\s[-–]\s/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (bare && bare.toLowerCase() !== find.name.toLowerCase()) {
    return lookupItunesTrack(bare, artist);
  }
  return first;
}

export async function enrichFinds(finds: Find[]): Promise<Find[]> {
  const out = [...finds];
  let cursor = 0;

  async function worker() {
    while (cursor < out.length) {
      const index = cursor++;
      const find = out[index];
      const info = await lookupFind(find).catch(() => null);
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
      return "Music discovery isn't switched on yet: LASTFM_API_KEY is missing.";
    case "unavailable":
      return "Couldn't reach Last.fm just now. The picks come back as soon as it does.";
    default:
      return "";
  }
}
