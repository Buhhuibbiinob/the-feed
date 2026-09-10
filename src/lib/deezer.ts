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


/*
 * There was a getDeezerSceneShelf here and it is the bug the shelves
 * were reported for.
 *
 * It filled a scene's shelf by SEARCHING Deezer for the scene's name.
 * Searching for "uk r&b" returns records whose title or artist contains
 * those words; it does not return UK R&B. So the shelves came back full
 * of things that were not the genre at all, and read exactly as what
 * they were - somebody typing the filter into a search box and shipping
 * the results.
 *
 * The weakness was written down in its own comment ("it is a text search
 * and it will be approximate at the edges") and shipped anyway. It is
 * not approximate at the edges. It is a different question.
 *
 * Deleted rather than left unused, because the next person looking for a
 * way to fill an empty shelf would find it and reach for it. Scene
 * shelves now walk a tag to its ARTISTS - a tag is somebody saying this
 * artist IS this thing - and into their catalogues. See
 * sceneShelfFromArtists in lib/shelves.
 *
 * Deezer is still here for what it is genuinely good at, below and in
 * lib/catalogue: given a record's real name and artist, it finds that
 * record's cover and clip with thirty times Apple's headroom.
 */


/**
 * Songs for a search box, from Deezer.
 *
 * The post form's track search was Apple only, so "The music catalogue
 * is busy. Give it a couple of seconds." is what somebody got whenever
 * a shelf happened to be loading - Apple allows about twenty calls a
 * minute for the entire site, and a person typing a song name loses that
 * race to a page full of covers every time.
 *
 * Deezer answers the same question with about thirty times the headroom,
 * and returns the cover and the clip in the same response. So the box
 * has somewhere to go instead of telling somebody to wait.
 *
 * Shaped exactly like Apple's result so the caller cannot tell which one
 * answered - the id is prefixed, because it is a Deezer id and something
 * downstream would otherwise treat it as Apple's.
 */
export async function searchDeezerSongs(
  query: string,
  limit = 10
): Promise<{
  id: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
  previewUrl: string | null;
}[]> {
  try {
    const res = await cachedFetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=${limit}`,
      600
    );
    if (!res || !res.ok) return [];
    const data = (await res.json()) as { data?: (DeezerTrack & { id?: number })[]; error?: unknown };
    if (data.error || !Array.isArray(data.data)) return [];
    return data.data
      .filter((track) => (track.title ?? track.title_short) && track.artist?.name)
      .map((track) => ({
        id: `dz-${track.id ?? track.link ?? Math.random().toString(36).slice(2)}`,
        title: (track.title_short ?? track.title ?? "").trim(),
        artist: (track.artist?.name ?? "").trim(),
        artworkUrl:
          track.album?.cover_big ?? track.album?.cover_medium ?? track.album?.cover_xl ?? null,
        previewUrl: track.preview ?? null,
      }));
  } catch {
    return [];
  }
}
