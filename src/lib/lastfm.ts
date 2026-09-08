// Last.fm's free API stands in for Spotify's now-deprecated new-releases
// endpoint. Last.fm has no real "release date" chart, so this surfaces what's
// currently trending across the whole service instead of strict new releases.
import { GENRES } from "@/lib/genres";
import { cachedFetch } from "@/lib/cachedFetch";

export type LastfmTrack = {
  id: string;
  name: string;
  artist: string;
  imageUrl: string | null;
  /** Last.fm listener count where the endpoint reports it. Discovery uses
   *  this to actually exclude hits rather than only skipping list positions:
   *  a popular artist's fourth-most-played track is still a hit. */
  listeners?: number;
};

type RawLastfmTrack = {
  name: string;
  artist?: { name?: string };
  image?: { size: string; "#text": string }[];
  listeners?: string;
};

// Last.fm returns this same placeholder image hash for every track that
// doesn't have real cover art uploaded to their catalog, instead of an
// empty string - so a plain falsy check doesn't catch it.
const LASTFM_PLACEHOLDER_HASH = "2a96cbd8b46e442fc41c2b86b821562f";

function realImageUrl(url: string | undefined): string | null {
  if (!url || url.includes(LASTFM_PLACEHOLDER_HASH)) return null;
  return url;
}

export async function getTrendingTracks(limit = 20): Promise<LastfmTrack[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await cachedFetch(
      `https://ws.audioscrobbler.com/2.0/?method=chart.gettoptracks&api_key=${apiKey}&format=json&limit=${limit}`,
      3600
    );
    if (!res || !res.ok) return [];

    const data = (await res.json()) as { tracks?: { track?: RawLastfmTrack[] } };
    const tracks = data.tracks?.track ?? [];

    return tracks
      .filter((t) => t.name && t.artist?.name)
      .map((t) => ({
        id: `${t.artist?.name}-${t.name}`,
        name: t.name,
        artist: t.artist!.name!,
        imageUrl: realImageUrl(t.image?.find((i) => i.size === "extralarge")?.["#text"]),
        listeners: t.listeners ? Number(t.listeners) : undefined,
      }));
  } catch {
    return [];
  }
}

// Eras a bot can pull from. Last.fm's decade tags are large, human-curated
// buckets, so tag.getTopTracks against them returns the songs people
// actually still listen to from that decade rather than an arbitrary slice
// of the catalogue. "current" is the live chart.
export const MUSIC_ERAS = [
  { id: "current", label: "Right now", tag: null },
  { id: "2010s", label: "2010s", tag: "2010s" },
  { id: "2000s", label: "2000s", tag: "00s" },
  { id: "90s", label: "90s", tag: "90s" },
  { id: "80s", label: "80s", tag: "80s" },
  { id: "70s", label: "70s", tag: "70s" },
] as const;

export type MusicEraId = (typeof MUSIC_ERAS)[number]["id"];

/**
 * Top tracks for one Last.fm tag. Used for the decade buckets, so a bot can
 * review a 1977 record as readily as something from this week.
 *
 * Tag charts move slowly, so these are cached for a day rather than the
 * hour the live chart uses.
 */
export async function getTracksByTag(tag: string, limit = 50, page = 1): Promise<LastfmTrack[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await cachedFetch(
      `https://ws.audioscrobbler.com/2.0/?method=tag.gettoptracks&tag=${encodeURIComponent(
        tag
      )}&api_key=${apiKey}&format=json&limit=${limit}&page=${page}`,
      86400
    );
    if (!res || !res.ok) return [];

    const data = (await res.json()) as { tracks?: { track?: RawLastfmTrack[] } };
    return (data.tracks?.track ?? [])
      .filter((t) => t.name && t.artist?.name)
      .map((t) => ({
        id: `${t.artist?.name}-${t.name}`,
        name: t.name,
        artist: t.artist!.name!,
        // Tag charts don't carry usable art, so this is filled in later from
        // the video thumbnail rather than left as Last.fm's placeholder.
        imageUrl: realImageUrl(t.image?.find((i) => i.size === "extralarge")?.["#text"]),
        listeners: t.listeners ? Number(t.listeners) : undefined,
      }));
  } catch {
    return [];
  }
}

/** Tracks for one era id, falling back to the live chart for "current". */
export async function getTracksForEra(era: MusicEraId, limit = 50): Promise<LastfmTrack[]> {
  const entry = MUSIC_ERAS.find((e) => e.id === era) ?? MUSIC_ERAS[0];
  return entry.tag ? getTracksByTag(entry.tag, limit) : getTrendingTracks(limit);
}

/** A track from anywhere in the catalogue - any era, weighted evenly, so
 *  the feed doesn't collapse into whatever is charting this week. */
export async function getTrackFromAnyEra(): Promise<LastfmTrack | null> {
  const era = MUSIC_ERAS[Math.floor(Math.random() * MUSIC_ERAS.length)];
  const tracks = await getTracksForEra(era.id, 50).catch(() => []);
  if (tracks.length === 0) {
    const fallback = await getTrendingTracks(30).catch(() => []);
    return fallback.length ? fallback[Math.floor(Math.random() * fallback.length)] : null;
  }
  // Even a decade bucket gets the hit filter, or "the 80s" is just the same
  // twenty songs everybody can already hum.
  const found = excludeHits(tracks);
  return found[Math.floor(Math.random() * found.length)];
}

/**
 * Every corner of the catalogue this site is willing to dig in.
 *
 * This was eighteen tags, written by hand. Eighteen. Every crate anybody
 * has ever opened and every Discover rail anybody has ever seen was
 * drawn from the same eighteen corners, which is exactly why it went
 * round in circles: there was no "all over" to go to. Hyperpop, digicore
 * and midwest emo are good corners and they are not the world.
 *
 * The genre taxonomy already lists three hundred and seventy-four music
 * genres, family by family, and every one of them is a tag Last.fm
 * understands. So that is the pool now - the whole of it - and the
 * original eighteen keep their place at the front because they are known
 * deep corners rather than guesses.
 *
 * Slugs become tag text: Last.fm files "uk garage" and "city pop" with
 * spaces, not hyphens. A few genres are ours rather than theirs and will
 * come back empty; that is what the fallbacks downstream are for, and an
 * empty answer from one lane out of three hundred is a far smaller
 * problem than three hundred lanes that were never asked.
 */
const DEEP_CORNERS = [
  "hyperpop",
  "digicore",
  "bedroom pop",
  "underground hip hop",
  "experimental",
  "shoegaze",
  "dream pop",
  "art pop",
  "glitch",
  "ambient pop",
  "midwest emo",
  "jungle",
  "breakcore",
  "neo-soul",
  "alternative r&b",
  "post-punk",
  "slowcore",
  "plugg",
];

/** Where a slug and the tag people actually use differ. */
const TAG_TEXT: Record<string, string> = {
  rnb: "rnb",
  "contemporary-rnb": "contemporary r&b",
  "alternative-rnb": "alternative r&b",
  pbrnb: "alternative r&b",
  // Slug to the words people actually tag with. "uk rnb" is nearly
  // unused on Last.fm and "uk r&b" is the real tag, so a shelf built
  // from the slug straight would come back empty and read as a scene
  // nobody records in.
  "uk-rnb": "uk r&b",
  britfunk: "brit funk",
  drain: "drain gang",
  "drum-and-bass": "drum and bass",
  "liquid-dnb": "liquid drum and bass",
  "city-pop-jp": "city pop",
  "black-and-white": "black and white",
  "2-step": "2 step",
  "d-beat": "dbeat",
  "p-funk": "p funk",
  "g-funk": "g funk",
  oi: "oi",
  idm: "idm",
  edm: "edm",
  ebm: "ebm",
  mpb: "mpb",
};

export function tagText(slug: string): string {
  return TAG_TEXT[slug] ?? slug.replace(/-/g, " ");
}

export const DISCOVERY_TAGS: readonly string[] = (() => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of [...DEEP_CORNERS, ...GENRES.music.map(tagText)]) {
    const clean = tag.trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out;
})();

/**
 * Artists to start discovery from when the community hasn't posted
 * enough to seed it themselves.
 *
 * Not a canon and not a chart. Every name here is a corner of the map
 * worth walking out from, because that is literally what happens to it:
 * one is picked at random, and half the time the engine steps one artist
 * sideways before choosing a track. A seed is a starting point, so what
 * matters is where it leads rather than how big it is.
 *
 * Two lanes, on purpose. One list of one scene walks out into the same
 * neighbourhood every time however long it gets - which is what "it gets
 * repetitive" was. Two unconnected corners of music means the sideways
 * step lands somewhere genuinely different depending on where it
 * started, and neither lane can crowd the other out because the pick is
 * random across both.
 */

/**
 * Underground, in the sense the word actually gets used: digicore,
 * plugg, hyperpop, the internet's own scenes. Mostly people with no
 * radio history at all, where the deep cut IS the catalogue.
 */
const SEEDS_UNDERGROUND = [
  "2hollis",
  "Lucy Bedroque",
  "Tezzus",
  "Nine Vicious",
  "Rommulas",
  "f5ve",
  "Canelle",
  "Jane Remover",
  "underscores",
  "quannnic",
  "Ecco2k",
  "Bladee",
  "yeule",
  "Alice Longyu Gao",
  "Frost Children",
  "Nourished by Time",
  "MJ Lenderman",
  "Wisp",
  "d4vd",
  "brakence",
  "glaive",
  "Sematary",
  "Aidan Bissett",
  "midwxst",
  "ericdoa",
  "aldn",
  "8485",
  "Blackwinterwells",
  "osquinn",
  "Nettspend",
  "osamason",
  "xaviersobased",
];

/**
 * R&B and soul, weighted to the UK and to the people who never got the
 * single - the lane somebody asked for by name and the site had none of.
 *
 * A couple of these are famous. That is fine and slightly the point:
 * the engine skips an artist's top three tracks and drops anything with
 * radio numbers, so a big name here comes back as the record off the
 * album rather than the one off the advert.
 */
const SEEDS_RNB = [
  "KWN",
  "Sasha Keable",
  "Isaiah Falls",
  "Kehlani",
  "Cleo Sol",
  "Tiana Major9",
  "Mahalia",
  "Jorja Smith",
  "Ama Lou",
  "RAY BLK",
  "Snoh Aalegra",
  "UMI",
  "Alex Isley",
  "Baby Rose",
  "Joyce Wrice",
  "Sinead Harnett",
  "Bellah",
  "Greentea Peng",
  "Olivia Dean",
  "Amaria",
  "Léa Sen",
  "Kadeem Tyrell",
];

export const SEED_ARTISTS = [...SEEDS_UNDERGROUND, ...SEEDS_RNB];

type RawArtist = { name?: string };

/** Artists Last.fm considers adjacent to this one. The engine behind
 *  "more artists like that". */
export async function getSimilarArtists(artist: string, limit = 20): Promise<string[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await cachedFetch(
      `https://ws.audioscrobbler.com/2.0/?method=artist.getsimilar&artist=${encodeURIComponent(
        artist
      )}&api_key=${apiKey}&format=json&limit=${limit}`,
      86400
    );
    if (!res || !res.ok) return [];
    const data = (await res.json()) as { similarartists?: { artist?: RawArtist[] } };
    return (data.similarartists?.artist ?? [])
      .map((a) => a.name)
      .filter((n): n is string => Boolean(n));
  } catch {
    return [];
  }
}

/** One artist's top tracks, most played first. */
export async function getArtistTopTracks(artist: string, limit = 30): Promise<LastfmTrack[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await cachedFetch(
      `https://ws.audioscrobbler.com/2.0/?method=artist.gettoptracks&artist=${encodeURIComponent(
        artist
      )}&api_key=${apiKey}&format=json&limit=${limit}`,
      86400
    );
    if (!res || !res.ok) return [];
    const data = (await res.json()) as { toptracks?: { track?: RawLastfmTrack[] } };
    return (data.toptracks?.track ?? [])
      .filter((t) => t.name)
      .map((t) => ({
        id: `${t.artist?.name ?? artist}-${t.name}`,
        name: t.name,
        artist: t.artist?.name ?? artist,
        imageUrl: realImageUrl(t.image?.find((i) => i.size === "extralarge")?.["#text"]),
        listeners: t.listeners ? Number(t.listeners) : undefined,
      }));
  } catch {
    return [];
  }
}

// Above this many Last.fm listeners a track is a hit, not a find.
//
// Was four hundred thousand, which only excluded records with radio
// history - a track with three hundred thousand listeners is not a find,
// it is something most people in that scene already own. A hundred and
// twenty thousand is the line where an artist stops being one somebody
// browsing this shelf has probably met.
//
// Lowering it cannot empty a rail: excludeHits hands back the unfiltered
// list when the filter takes everything, because an artist with no
// obscure tracks should still have a catalogue rather than nothing.
const HIT_LISTENER_CEILING = 120_000;

/** Drops tracks big enough that surfacing them isn't a discovery. Tracks
 *  with no listener data are kept, since the endpoint not reporting it is
 *  not evidence of popularity.
 *
 *  IMPORTANT: tag.getTopTracks does not report listeners at all, so this
 *  filters NOTHING on a scene or decade chart - which is how "...Baby One
 *  More Time" and "The Sign" ended up under "Deeper into the 90s".
 *  Rank is the only popularity signal those charts carry, so callers use
 *  DEEP_PAGE below instead of relying on this. */
export function excludeHits(tracks: LastfmTrack[]): LastfmTrack[] {
  const found = tracks.filter((t) => t.listeners === undefined || t.listeners < HIT_LISTENER_CEILING);
  // If filtering wiped everything, the artist simply has no obscure tracks -
  // better to return their catalogue than nothing at all.
  return found.length > 0 ? found : tracks;
}

/**
 * How far into a tag chart the deep cuts start.
 *
 * A tag chart is ordered by play count and reports nothing else, so rank
 * IS the popularity signal - and page one of "90s" is precisely the
 * twenty songs everybody can already hum. Page four is rank 150-200:
 * still well-played enough to be good, far enough down that somebody
 * choosing to browse that shelf probably has not heard them.
 */
export const DEEP_PAGE = 4;

/** A tag's deep cuts: far enough down the chart to be a find. */
export async function getDeepTracksByTag(tag: string, limit = 50): Promise<LastfmTrack[]> {
  const deep = await getTracksByTag(tag, limit, DEEP_PAGE);
  // A small tag runs out before page four. Falling back one page at a
  // time keeps a niche scene usable instead of returning nothing.
  if (deep.length >= 10) return deep;
  const middle = await getTracksByTag(tag, limit, 2);
  return middle.length > 0 ? middle : getTracksByTag(tag, limit, 1);
}

/**
 * Names that are not artists.
 *
 * Reviews posted before song search moved to Apple stored whatever
 * YouTube called the channel, so the artist on an old review is often
 * "TheFugeesVEVO", "Lady Gaga - Topic" or "Ne-Yo - Topic". Seeding
 * discovery from those produces "Because you liked TLCVEVO", and looking
 * them up in Apple's catalogue finds nothing - which is also why some
 * cards had no artwork and no play button.
 */
export function cleanArtistName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/\s*[-–—]\s*Topic\s*$/i, "")
    .replace(/VEVO\s*$/i, "")
    .replace(/\s*-\s*Official(\s+(Channel|Music|Video|Audio))?\s*$/i, "")
    .replace(/\s*\bOfficial\b\s*$/i, "")
    .replace(/\s*[-–—]\s*Records\s*$/i, "")
    .replace(/^The(?=[A-Z])/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  // A name that was ONLY the suffix is not a name.
  return cleaned.length >= 2 ? cleaned : null;
}

/**
 * A deep cut: walk one step out from a seed artist to somebody adjacent,
 * then take a track from PAST their most-played few.
 *
 * Skipping the top of the list is the whole point. An artist's #1 track is
 * the one everybody already knows; index 3 onward is where the record
 * someone would actually be pleased to be reminded of lives.
 */
export async function getDeepCut(seeds: string[]): Promise<LastfmTrack | null> {
  const pool = seeds.length ? seeds : SEED_ARTISTS;

  // Two goes at it, from two different seeds.
  //
  // A seed can come up empty for reasons that have nothing to do with
  // the person browsing: a name spelled differently on Last.fm than the
  // way it is written here, an artist too new to have a page, or a
  // member whose own posts seeded this with somebody the service has
  // never heard of. One go meant that landed as a blank space where a
  // record should be, and the only way to get another was to reload -
  // so it read as broken rather than as unlucky.
  //
  // The retry is cheap because it is rare: it only happens when the
  // first seed produced nothing at all, which is the one case where not
  // asking again means showing nobody anything.
  for (let attempt = 0; attempt < 2; attempt++) {
    const seed = pool[Math.floor(Math.random() * pool.length)];

    // Half the time review the seed artist themselves, half the time step
    // out to a neighbour, so the pool widens over time instead of orbiting
    // a fixed list.
    let artist = seed;
    if (Math.random() < 0.5) {
      const similar = await getSimilarArtists(seed, 20).catch(() => []);
      if (similar.length) artist = similar[Math.floor(Math.random() * similar.length)];
    }

    const tracks = await getArtistTopTracks(artist, 30).catch(() => []);
    if (tracks.length === 0) continue;

    const deep = excludeHits(tracks.slice(3));
    const from = deep.length >= 3 ? deep : excludeHits(tracks);
    if (from.length === 0) continue;
    return from[Math.floor(Math.random() * from.length)];
  }
  return null;
}

/** A track from one of the scene tags rather than a decade or a chart. */
export async function getSceneTrack(): Promise<LastfmTrack | null> {
  const tag = DISCOVERY_TAGS[Math.floor(Math.random() * DISCOVERY_TAGS.length)];
  const tracks = await getTracksByTag(tag, 50).catch(() => []);
  if (tracks.length === 0) return null;
  // Skip the handful everyone already knows from each scene, then drop
  // anything that's a hit regardless of where it sat in the list.
  const deep = excludeHits(tracks.slice(5));
  const from = deep.length >= 5 ? deep : excludeHits(tracks);
  return from[Math.floor(Math.random() * from.length)];
}
