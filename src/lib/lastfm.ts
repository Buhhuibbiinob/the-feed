// Last.fm's free API stands in for Spotify's now-deprecated new-releases
// endpoint. Last.fm has no real "release date" chart, so this surfaces what's
// currently trending across the whole service instead of strict new releases.
export type LastfmTrack = {
  id: string;
  name: string;
  artist: string;
  imageUrl: string | null;
};

type RawLastfmTrack = {
  name: string;
  artist?: { name?: string };
  image?: { size: string; "#text": string }[];
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
    const res = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=chart.gettoptracks&api_key=${apiKey}&format=json&limit=${limit}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];

    const data = (await res.json()) as { tracks?: { track?: RawLastfmTrack[] } };
    const tracks = data.tracks?.track ?? [];

    return tracks
      .filter((t) => t.name && t.artist?.name)
      .map((t) => ({
        id: `${t.artist?.name}-${t.name}`,
        name: t.name,
        artist: t.artist!.name!,
        imageUrl: realImageUrl(t.image?.find((i) => i.size === "extralarge")?.["#text"]),
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
export async function getTracksByTag(tag: string, limit = 50): Promise<LastfmTrack[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=tag.gettoptracks&tag=${encodeURIComponent(
        tag
      )}&api_key=${apiKey}&format=json&limit=${limit}`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return [];

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
  return tracks[Math.floor(Math.random() * tracks.length)];
}

// Tags that surface scenes rather than charts. The decade buckets give
// range; these give depth - the corners of Last.fm where the listener
// counts are small and the records are the reason people are there.
export const DISCOVERY_TAGS = [
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

/**
 * Artists to start discovery from when the community hasn't posted enough
 * to seed it themselves. Deliberately small and specific rather than a
 * canon: these are the corner of the map worth walking out from.
 */
export const SEED_ARTISTS = [
  "2hollis",
  "Lucy Bedroque",
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
];

type RawArtist = { name?: string };

/** Artists Last.fm considers adjacent to this one. The engine behind
 *  "more artists like that". */
export async function getSimilarArtists(artist: string, limit = 20): Promise<string[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=artist.getsimilar&artist=${encodeURIComponent(
        artist
      )}&api_key=${apiKey}&format=json&limit=${limit}`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return [];
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
    const res = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=artist.gettoptracks&artist=${encodeURIComponent(
        artist
      )}&api_key=${apiKey}&format=json&limit=${limit}`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { toptracks?: { track?: RawLastfmTrack[] } };
    return (data.toptracks?.track ?? [])
      .filter((t) => t.name)
      .map((t) => ({
        id: `${t.artist?.name ?? artist}-${t.name}`,
        name: t.name,
        artist: t.artist?.name ?? artist,
        imageUrl: realImageUrl(t.image?.find((i) => i.size === "extralarge")?.["#text"]),
      }));
  } catch {
    return [];
  }
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
  const seed = pool[Math.floor(Math.random() * pool.length)];

  // Half the time review the seed artist themselves, half the time step out
  // to a neighbour, so the pool widens over time instead of orbiting a
  // fixed list.
  let artist = seed;
  if (Math.random() < 0.5) {
    const similar = await getSimilarArtists(seed, 20).catch(() => []);
    if (similar.length) artist = similar[Math.floor(Math.random() * similar.length)];
  }

  const tracks = await getArtistTopTracks(artist, 30).catch(() => []);
  if (tracks.length === 0) return null;

  const deep = tracks.slice(3);
  const from = deep.length >= 3 ? deep : tracks;
  return from[Math.floor(Math.random() * from.length)];
}

/** A track from one of the scene tags rather than a decade or a chart. */
export async function getSceneTrack(): Promise<LastfmTrack | null> {
  const tag = DISCOVERY_TAGS[Math.floor(Math.random() * DISCOVERY_TAGS.length)];
  const tracks = await getTracksByTag(tag, 50).catch(() => []);
  if (tracks.length === 0) return null;
  // Skip the handful everyone already knows from each scene.
  const deep = tracks.slice(5);
  const from = deep.length >= 5 ? deep : tracks;
  return from[Math.floor(Math.random() * from.length)];
}
