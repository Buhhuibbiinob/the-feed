// Apple's iTunes Search API - no API key or auth required, unlike Spotify's
// client-credentials flow. Used as the cover-art backfill for tracks whose
// Last.fm entry has no real artwork.
type ItunesTrack = {
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
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
// than no cover art), so the top result is only used if its track/artist
// actually match what was asked for.
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
    if (!res.ok) return null;

    const data = (await res.json()) as ItunesSearchResult;
    const match = findMatch(data.results ?? [], trackName, artistName);
    const art = match?.artworkUrl100;
    if (!art) return null;

    // iTunes serves a 100x100 thumbnail by default - swap the size segment
    // in the URL for a much larger image.
    return art.replace("100x100bb", "600x600bb");
  } catch {
    return null;
  }
}
