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
