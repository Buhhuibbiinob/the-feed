// Apple's iTunes Search API - no API key or auth required, unlike Spotify's
// client-credentials flow. Used as the cover-art backfill for tracks whose
// Last.fm entry has no real artwork.
import { cachedFetch } from "@/lib/cachedFetch";

type ItunesTrack = {
  wrapperType?: string;
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
  /** Apple's own 30-second clip. Public, keyless, and the reason
   *  discovery can be listened to rather than only read. */
  previewUrl?: string;
  trackViewUrl?: string;
  /** ISO date of the release this copy of the track belongs to. Note
   *  "this copy": the field is the COLLECTION's date, so a remaster
   *  reads as the remaster's year, not the record's. */
  releaseDate?: string;
};

/** What a lookup can tell us about one track. Every field is optional
 *  because the catalogue genuinely doesn't have all of them for
 *  everything - an obscure record often has art and no preview. */
export type ItunesTrackInfo = {
  artworkUrl: string | null;
  previewUrl: string | null;
  trackUrl: string | null;
  /** The year the recording came out, as far as the catalogue knows.
   *  Null when nothing matched, which is not the same as "it is not from
   *  that year" and must not be treated as one. */
  year: number | null;
};

const NO_TRACK_INFO: ItunesTrackInfo = {
  artworkUrl: null,
  previewUrl: null,
  trackUrl: null,
  year: null,
};

type ItunesArtist = {
  artistId?: number;
  artistName?: string;
};

type ItunesSearchResult = {
  results?: ItunesTrack[];
};

/**
 * One iTunes request, with the throttle told apart from a miss.
 *
 * Apple answers 403 when you have asked too often, and the old code did
 * `res.ok ? await res.json() : {}` - which turns "slow down" into "no
 * such track", silently and permanently. On a shelf of twenty four
 * records that is what put artwork on two of them and blank squares on
 * the other twenty two: they were all throttled, and every one of them
 * reported that it simply was not in the catalogue.
 *
 * So: three goes, backing off, and a flag saying which kind of empty
 * this is. Apple's limit is around twenty calls a minute, so waiting is
 * genuinely the fix rather than a way of hiding one.
 */
const RETRY_DELAYS_MS = [700, 1800];

async function itunesFetch(url: string): Promise<{ data: unknown; throttled: boolean }> {
  for (let attempt = 0; ; attempt++) {
    // Actually cached. `next: { revalidate }` alone sets a lifetime and
    // does not opt in, so every sleeve on every shelf on every view was
    // a live call against a limit of roughly twenty a minute. Most of
    // the throttling this function works so hard to survive was this.
    const res = await cachedFetch(url, 3600);
    if (!res) return { data: null, throttled: false };
    if (res.ok) return { data: await res.json(), throttled: false };
    // 403 is the throttle; 429 is too, on some edges.
    const throttled = res.status === 403 || res.status === 429;
    if (!throttled || attempt >= RETRY_DELAYS_MS.length) return { data: null, throttled };
    await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
  }
}

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

/**
 * The year a recording came out, taken as the earliest the catalogue has.
 *
 * iTunes' releaseDate is the date of the COLLECTION a copy sits on, so
 * asking the top match gives you the anniversary edition: "Heart of
 * Glass" off a 2014 remaster reads as 2014, and a shelf that trusted
 * that would throw the record off its own decade for being too new.
 *
 * Every result that really is this track by this artist is the same
 * recording on a different release, so the earliest of them is the one
 * that is not a reissue. It is not free of error - a catalogue can be
 * missing the original press entirely - but it is wrong in one
 * direction only, and always by being too late, which matters because
 * the shelf that uses this treats "too late" as the only failure worth
 * acting on.
 */
function earliestYear(
  results: ItunesTrack[],
  trackName: string,
  artistName: string
): number | null {
  let best: number | null = null;
  for (const r of results) {
    if (!findMatch([r], trackName, artistName)) continue;
    const year = Number(r.releaseDate?.slice(0, 4));
    if (!Number.isFinite(year) || year < 1900) continue;
    if (best === null || year < best) best = year;
  }
  return best;
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
      const { data: artistPayload } = await itunesFetch(
        `https://itunes.apple.com/search?${artistParams.toString()}`
      );
      if (!artistPayload) return [];
      const artistData = artistPayload as { results?: ItunesArtist[] };
      const bestArtist = artistData.results?.find((a) => {
        const gotArtist = normalize(a.artistName ?? "");
        return gotArtist === key || gotArtist.includes(key) || key.includes(gotArtist);
      });
      if (!bestArtist?.artistId) return [];

      const catalogParams = new URLSearchParams({ id: String(bestArtist.artistId), entity: "song", limit: "200" });
      const { data: catalogPayload } = await itunesFetch(
        `https://itunes.apple.com/lookup?${catalogParams.toString()}`
      );
      if (!catalogPayload) return [];
      const catalogData = catalogPayload as ItunesSearchResult;
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
  artistName: string,
  /**
   * Whether to fall back to the artist's whole catalogue on a miss.
   *
   * Worth two extra requests when somebody is waiting on one record.
   * Ruinous in a batch: a shelf of a genuinely obscure tag misses on
   * nearly everything, and every miss then costs three requests instead
   * of one - so twenty four records became about seventy calls against a
   * limit of twenty a minute, each throttle adding two and a half
   * seconds of backoff on top. That is the shelf that never finishes
   * loading, and it is spent entirely on records Apple does not have.
   */
  { deep = true }: { deep?: boolean } = {}
): Promise<ItunesTrackInfo> {
  try {
    const params = new URLSearchParams({
      term: `${trackName} ${artistName}`,
      media: "music",
      entity: "song",
      limit: "8",
    });
    const { data, throttled } = await itunesFetch(
      `https://itunes.apple.com/search?${params.toString()}`
    );
    let pool = ((data as ItunesSearchResult) ?? {}).results ?? [];
    let match = findMatch(pool, trackName, artistName);

    // The artist catalogue fallback is two more requests, and firing it
    // after a throttled search is two more requests that were never going
    // to be answered - it makes the queue worse for everything behind it.
    // Only worth it when the search really did come back and really did
    // not have the track.
    if (!match && !throttled && deep) {
      const catalog = await getArtistCatalog(artistName);
      match = findMatch(catalog, trackName, artistName);
      // The year is read off whichever pool the match came from, not
      // always the search results - otherwise a track only the artist
      // catalogue could find would come back dated null.
      if (match) pool = catalog;
    }
    if (!match) return NO_TRACK_INFO;

    return {
      // iTunes serves a 100x100 thumbnail by default - swap the size
      // segment in the URL for a much larger image.
      artworkUrl: match.artworkUrl100?.replace("100x100bb", "600x600bb") ?? null,
      previewUrl: match.previewUrl ?? null,
      trackUrl: match.trackViewUrl ?? null,
      year: earliestYear(pool, trackName, artistName),
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
  const res = await cachedFetch(`https://itunes.apple.com/search?${params.toString()}`, 3600);
  if (!res) throw new Error("Couldn't reach iTunes.");
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
