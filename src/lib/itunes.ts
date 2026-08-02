// Apple's iTunes Search API - no API key or auth required, unlike Spotify's
// client-credentials flow. Used as the cover-art backfill for tracks whose
// Last.fm entry has no real artwork.
type ItunesSearchResult = {
  results?: { artworkUrl100?: string }[];
};

export async function searchItunesArt(query: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      term: query,
      media: "music",
      entity: "song",
      limit: "1",
    });
    const res = await fetch(`https://itunes.apple.com/search?${params.toString()}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as ItunesSearchResult;
    const art = data.results?.[0]?.artworkUrl100;
    if (!art) return null;

    // iTunes serves a 100x100 thumbnail by default - swap the size segment
    // in the URL for a much larger image.
    return art.replace("100x100bb", "600x600bb");
  } catch {
    return null;
  }
}
