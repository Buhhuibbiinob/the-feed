// Apple's iTunes Search API - no API key or auth required, unlike Spotify's
// client-credentials flow. Used as the cover-art backfill for tracks whose
// Last.fm entry has no real artwork.
type ItunesTrack = {
  wrapperType?: string;
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
  /** Apple's own 30-second clip. Public, keyless, and the reason
   *  discovery can be listened to rather than only read. */
  previewUrl?: string;
  trackViewUrl?: string;
};

/** What a lookup can tell us about one track. Every field is optional
 *  because the catalogue genuinely doesn't have all of them for
 *  everything - an obscure record often has art and no preview. */
export type ItunesTrackInfo = {
  artworkUrl: string | null;
  previewUrl: string | null;
  trackUrl: string | null;
};

const NO_TRACK_INFO: ItunesTrackInfo = { artworkUrl: null, previewUrl: null, trackUrl: null };

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

/**
 * Everything the catalogue has for one track: art, the 30-second preview,
 * and a link to the store page.
 *
 * Same matching rules as before - a confident-looking wrong answer is
 * worse than no answer, so a result is only used when its track and
 * artist actually match what was asked for.
 */
export async function lookupItunesTrack(
  trackName: string,
  artistName: string
): Promise<ItunesTrackInfo> {
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
    if (!match) return NO_TRACK_INFO;

    return {
      // iTunes serves a 100x100 thumbnail by default - swap the size
      // segment in the URL for a much larger image.
      artworkUrl: match.artworkUrl100?.replace("100x100bb", "600x600bb") ?? null,
      previewUrl: match.previewUrl ?? null,
      trackUrl: match.trackViewUrl ?? null,
    };
  } catch {
    return NO_TRACK_INFO;
  }
}

export async function searchItunesArt(trackName: string, artistName: string): Promise<string | null> {
  const { artworkUrl } = await lookupItunesTrack(trackName, artistName);
  return artworkUrl;
}

/** One row in a song search. */
export type ItunesSong = {
  /** Apple's track id. Unique within a result list, and not a YouTube id. */
  id: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
  previewUrl: string | null;
};

type ItunesSongResult = ItunesTrack & { trackId?: number; collectionName?: string };

/**
 * Songs matching a free-text query.
 *
 * This is a general search rather than the exact-match lookup above: the
 * person typing is browsing, so "close enough" is the right answer and
 * the confident-wrong-answer problem doesn't apply - they can see the
 * results and pick.
 *
 * Apple charges nothing for this and asks for no key, which is the whole
 * reason it exists: the same box on YouTube costs 100 units of a
 * 10,000-a-day quota per keystroke that gets through the debounce.
 */
export async function searchItunesSongs(query: string, limit = 10): Promise<ItunesSong[]> {
  const params = new URLSearchParams({
    term: query,
    media: "music",
    entity: "song",
    limit: String(limit),
  });
  const res = await fetch(`https://itunes.apple.com/search?${params.toString()}`, {
    next: { revalidate: 3600 },
  });
  // Unlike the art backfill, a failure here is worth telling apart from
  // "no such song" - the box says which.
  if (!res.ok) throw new Error(`iTunes search failed: ${res.status}`);

  const data = (await res.json()) as { results?: ItunesSongResult[] };
  return (data.results ?? [])
    .filter((r) => r.trackName && r.artistName && r.trackId)
    .map((r) => ({
      id: String(r.trackId),
      title: r.trackName!,
      artist: r.artistName!,
      artworkUrl: r.artworkUrl100?.replace("100x100bb", "300x300bb") ?? null,
      previewUrl: r.previewUrl ?? null,
    }));
}
