import { cachedFetch } from "@/lib/cachedFetch";
import type { ItunesTrackInfo } from "@/lib/itunes";

// The second catalogue, and the one with room to breathe.
//
// Apple is free and keyless and allows roughly twenty calls a minute
// across everything this site does, which is the single fact behind most
// of the trouble this area has had: blank sleeves, shelves that empty
// themselves, a search box told the catalogue is busy while a page of
// covers loads behind it. Twenty a minute is not enough for a site with
// people on it.
//
// Deezer's public API is also free, also keyless, and allows roughly
// fifty requests every five seconds - about thirty times as much. It
// returns a 30-second preview and cover art for most of what Apple has
// and a good deal of what Apple does not, particularly outside the
// English-language catalogue.
//
// So it is not a fallback in the sense of a worse option. It is the
// pressure valve: when Apple says no, or has never heard of the record,
// this is asked instead, and the answer is written to the same shared
// cache so nobody pays for it twice.
//
// What it does NOT give is a reliable release year - the search result
// carries an album but not its date, and fetching that is another
// request per record. So a record rescued from here comes back with a
// null year, which the shelves already handle correctly: an unknown year
// keeps its place rather than being thrown off a decade it might belong
// to.

export type DeezerTrack = {
  title?: string;
  title_short?: string;
  preview?: string;
  link?: string;
  artist?: { name?: string };
  album?: { cover_xl?: string; cover_big?: string; cover_medium?: string };
};

type DeezerSearch = { data?: DeezerTrack[]; error?: unknown };

type DeezerSceneTrack = DeezerTrack & { id?: number; rank?: number };

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stripParens(s: string): string {
  return s.replace(/[([].*?[)\]]/g, "").trim();
}

/**
 * The same strictness Apple's lookup uses, for the same reason.
 *
 * A search is a relevance search, so asking for an obscure track by a
 * well-known artist returns that artist's hits. Wrong cover art is worse
 * than no cover art: a record with somebody else's sleeve on it is not a
 * near miss, it is a lie the page tells confidently.
 */
export function findMatch(
  results: DeezerTrack[],
  trackName: string,
  artistName: string
): DeezerTrack | undefined {
  const wantTrack = normalize(trackName);
  const wantArtist = normalize(artistName);
  return results.find((r) => {
    const gotArtist = normalize(r.artist?.name ?? "");
    if (!gotArtist) return false;
    const artistMatches = gotArtist.includes(wantArtist) || wantArtist.includes(gotArtist);
    if (!artistMatches) return false;

    const raw = r.title ?? r.title_short ?? "";
    const gotTrack = normalize(raw);
    const gotCore = normalize(stripParens(raw));
    return (
      gotTrack === wantTrack ||
      gotTrack.startsWith(wantTrack) ||
      wantTrack.startsWith(gotTrack) ||
      (gotCore.length > 0 && (gotCore === wantTrack || wantTrack.startsWith(gotCore)))
    );
  });
}

/**
 * Art and a clip for one track, from Deezer.
 *
 * Never throws and never reports a throttle, because there is nothing
 * useful the caller could do with one: this IS the thing that gets tried
 * when the other catalogue is busy. An empty answer here means Deezer
 * genuinely did not have it, or was unreachable, and either way the next
 * step is the same.
 */
export async function lookupDeezerTrack(
  trackName: string,
  artistName: string
): Promise<ItunesTrackInfo> {
  const empty: ItunesTrackInfo = {
    artworkUrl: null,
    previewUrl: null,
    trackUrl: null,
    year: null,
  };
  try {
    const q = `track:"${trackName}" artist:"${artistName}"`;
    const res = await cachedFetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=10`,
      3600
    );
    if (!res || !res.ok) return empty;
    const data = (await res.json()) as DeezerSearch;
    // Deezer answers 200 with an error object rather than a status code
    // when it is unhappy, so an ok response is not an answer.
    if (data.error || !Array.isArray(data.data)) return empty;

    let match = findMatch(data.data, trackName, artistName);
    // The quoted field search is exact and misses a lot of spellings, so
    // a plain search is worth one more go. Still matched strictly, so a
    // loose query cannot put the wrong record on the shelf.
    if (!match) {
      const loose = await cachedFetch(
        `https://api.deezer.com/search?q=${encodeURIComponent(`${trackName} ${artistName}`)}&limit=10`,
        3600
      );
      if (loose && loose.ok) {
        const second = (await loose.json()) as DeezerSearch;
        if (!second.error && Array.isArray(second.data)) {
          match = findMatch(second.data, trackName, artistName);
        }
      }
    }
    if (!match) return empty;

    return {
      artworkUrl:
        match.album?.cover_xl ?? match.album?.cover_big ?? match.album?.cover_medium ?? null,
      previewUrl: match.preview ?? null,
      trackUrl: match.link ?? null,
      // Deliberately null. See the note at the top: the year would cost
      // another request per record, and an unknown year is handled
      // correctly everywhere while a guessed one is not.
      year: null,
    };
  } catch {
    return empty;
  }
}


/**
 * A scene's shelf, from Deezer.
 *
 * The sixteen internet scenes were built from YouTube, and YouTube kept
 * refusing - three different failures in three days, the last of which I
 * could not reproduce or diagnose from outside the deployment. A shelf
 * that only works when one service is happy is a shelf that is empty
 * whenever it is not.
 *
 * So there is another way to fill it, and this one needs no key, has no
 * daily allowance to run out, and is not rate limited by whoever else
 * happens to share a serverless IP with us - the three ways YouTube has
 * failed so far.
 *
 * It is not as good at naming a scene: Deezer has no "digicore" tag, so
 * this is a text search and it will be approximate at the edges. What it
 * gives in exchange is that every record on it is a real record with a
 * real cover and a real thirty-second clip, which is more than an empty
 * board with an apology on it.
 *
 * Ranked lowest-first on purpose. Deezer's rank IS its popularity
 * score, and the whole point of these shelves is the people who do not
 * have an audience yet.
 */
export async function getDeezerSceneShelf(
  sceneText: string,
  limit: number,
  rotateBy = 0
): Promise<{ name: string; artist: string; imageUrl: string | null; previewUrl: string | null; trackUrl: string | null }[]> {
  try {
    const res = await cachedFetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(sceneText)}&limit=100`,
      3600
    );
    if (!res || !res.ok) return [];
    const data = (await res.json()) as { data?: DeezerSceneTrack[]; error?: unknown };
    if (data.error || !Array.isArray(data.data)) return [];

    // Least popular first. A text search puts the biggest names on top,
    // which is the same repetition problem every other source has.
    const ranked = [...data.data].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    const start = ranked.length ? Math.abs(rotateBy) % ranked.length : 0;
    const ordered = [...ranked.slice(start), ...ranked.slice(0, start)];

    const seen = new Set<string>();
    const perArtist = new Map<string, number>();
    const out: {
      name: string;
      artist: string;
      imageUrl: string | null;
      previewUrl: string | null;
      trackUrl: string | null;
    }[] = [];
    for (const track of ordered) {
      const name = (track.title_short ?? track.title ?? "").trim();
      const artist = (track.artist?.name ?? "").trim();
      if (!name || !artist) continue;
      const key = `${name.toLowerCase()}|${artist.toLowerCase()}`;
      if (seen.has(key)) continue;
      // Three each, the same rule every other shelf uses.
      const artistKey = artist.toLowerCase();
      const already = perArtist.get(artistKey) ?? 0;
      if (already >= 3) continue;
      perArtist.set(artistKey, already + 1);
      seen.add(key);
      out.push({
        name,
        artist,
        imageUrl:
          track.album?.cover_xl ?? track.album?.cover_big ?? track.album?.cover_medium ?? null,
        previewUrl: track.preview ?? null,
        trackUrl: track.link ?? null,
      });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}
