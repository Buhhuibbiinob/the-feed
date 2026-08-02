// Apple's iTunes Search API - no API key or auth required, unlike Spotify's
// client-credentials flow. Used as the cover-art backfill for tracks whose
// Last.fm entry has no real artwork.
type ItunesTrack = {
  wrapperType?: string;
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
};

type ItunesArtist = {
  artistId?: number;
  artistName?: string;
};

type ItunesSearchResult = {
  results?: ItunesTrack[];
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// iTunes titles collabs as "Song (with Other Artist)" while Last.fm often
// folds that into the track name itself ("Song + Other Artist") - stripping
// the parenthetical lets a core-title match still succeed for those.
function stripParens(s: string): string {
  return s.replace(/[([].*?[)\]]/g, "").trim();
}

// iTunes' search is a general relevance search, not an exact lookup - for an
// obscure/mistagged Last.fm track name it can confidently return a
// completely different song by the same artist (wrong cover art is worse
// than no cover art), so a result is only used if its track/artist actually
// match what was asked for.
function findMatch(results: ItunesTrack[], trackName: string, artistName: string): ItunesTrack | undefined {
  const wantTrack = normalize(trackName);
  const wantArtist = normalize(artistName);
  return results.find((r) => {
    const rawTrack = r.trackName ?? "";
    const gotArtist = normalize(r.artistName ?? "");
    const artistMatches = gotArtist.includes(wantArtist) || wantArtist.includes(gotArtist);
    if (!artistMatches) return false;

    const gotTrack = normalize(rawTrack);
    const gotCore = normalize(stripParens(rawTrack));
    return (
      gotTrack === wantTrack ||
      gotTrack.startsWith(wantTrack) ||
      wantTrack.startsWith(gotTrack) ||
      (gotCore.length > 0 && (gotCore === wantTrack || wantTrack.startsWith(gotCore)))
    );
  });
}

// Brand-new releases can take a while to surface in iTunes' general search
// relevance ranking even though the tracks already exist in the catalog -
// pulling the artist's own track listing directly finds them immediately.
// Cached per-artist (with a TTL, same idea as the 1hr fetch cache below)
// since multiple missing tracks in one batch are often by the same artist.
const artistCatalogCache = new Map<string, { promise: Promise<ItunesTrack[]>; expiresAt: number }>();
const CATALOG_CACHE_TTL_MS = 3600_000;

async function getArtistCatalog(artistName: string): Promise<ItunesTrack[]> {
  const key = normalize(artistName);
  const cached = artistCatalogCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = (async () => {
    try {
      const artistParams = new URLSearchParams({ term: artistName, entity: "musicArtist", limit: "3" });
      const artistRes = await fetch(`https://itunes.apple.com/search?${artistParams.toString()}`);
      if (!artistRes.ok) return [];
      const artistData = (await artistRes.json()) as { results?: ItunesArtist[] };
      const bestArtist = artistData.results?.find((a) => {
        const gotArtist = normalize(a.artistName ?? "");
        return gotArtist === key || gotArtist.includes(key) || key.includes(gotArtist);
      });
      if (!bestArtist?.artistId) return [];

      const catalogParams = new URLSearchParams({ id: String(bestArtist.artistId), entity: "song", limit: "200" });
      const catalogRes = await fetch(`https://itunes.apple.com/lookup?${catalogParams.toString()}`);
      if (!catalogRes.ok) return [];
      const catalogData = (await catalogRes.json()) as ItunesSearchResult;
      return (catalogData.results ?? []).filter((r) => r.wrapperType === "track");
    } catch {
      return [];
    }
  })();

  artistCatalogCache.set(key, { promise, expiresAt: Date.now() + CATALOG_CACHE_TTL_MS });
  return promise;
}

export async function searchItunesArt(trackName: string, artistName: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      term: `${trackName} ${artistName}`,
      media: "music",
      entity: "song",
      limit: "8",
    });
    const res = await fetch(`https://itunes.apple.com/search?${params.toString()}`, {
      next: { revalidate: 3600 },
    });
    const data = res.ok ? ((await res.json()) as ItunesSearchResult) : {};
    let match = findMatch(data.results ?? [], trackName, artistName);

    if (!match) {
      const catalog = await getArtistCatalog(artistName);
      match = findMatch(catalog, trackName, artistName);
    }

    const art = match?.artworkUrl100;
    if (!art) return null;

    // iTunes serves a 100x100 thumbnail by default - swap the size segment
    // in the URL for a much larger image.
    return art.replace("100x100bb", "600x600bb");
  } catch {
    return null;
  }
}
