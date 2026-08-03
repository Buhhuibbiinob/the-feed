// Apple's Marketing Tools RSS feeds - public, keyless, and they carry real
// release dates, which is what makes them usable for a date-scoped weekly
// newsletter. (The "most-recent" feed 404s; "most-played" is the one Apple
// actually serves, so we pull that and filter by releaseDate ourselves.)
export type AppleAlbum = {
  name: string;
  artistName: string;
  releaseDate: string | null;
  url: string;
  artworkUrl: string | null;
};

type AppleFeedResult = {
  name?: string;
  artistName?: string;
  releaseDate?: string;
  url?: string;
  artworkUrl100?: string;
};

export async function getTopAlbums(limit = 25): Promise<AppleAlbum[]> {
  try {
    const res = await fetch(
      `https://rss.marketingtools.apple.com/api/v2/us/music/most-played/${limit}/albums.json`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { feed?: { results?: AppleFeedResult[] } };
    return (data.feed?.results ?? [])
      .filter((r) => r.name && r.artistName)
      .map((r) => ({
        name: r.name!,
        artistName: r.artistName!,
        releaseDate: r.releaseDate ?? null,
        url: r.url ?? "",
        artworkUrl: r.artworkUrl100?.replace("100x100bb", "600x600bb") ?? null,
      }));
  } catch {
    return [];
  }
}

// Albums that actually came out inside a given window, newest first.
export async function getAlbumsReleasedBetween(startDate: string, endDate: string): Promise<AppleAlbum[]> {
  const albums = await getTopAlbums(100);
  return albums
    .filter((a) => a.releaseDate && a.releaseDate >= startDate && a.releaseDate <= endDate)
    .sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""));
}
