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
