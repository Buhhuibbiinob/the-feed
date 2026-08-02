import { searchItunesArt } from "@/lib/itunes";

// Last.fm's trending chart often has no real cover art for a track. This
// backfills missing art by searching Apple's iTunes catalog (no API key
// required, unlike Spotify) for the same name/artist.
export async function fillMissingArt<T extends { id: string; name: string; artist: string; imageUrl: string | null }>(
  tracks: T[]
): Promise<T[]> {
  const missing = tracks.filter((t) => !t.imageUrl);
  if (missing.length === 0) return tracks;

  const results = await Promise.all(
    missing.map(async (track) => ({
      id: track.id,
      imageUrl: await searchItunesArt(track.name, track.artist),
    }))
  );
  const artById = new Map(results.map((r) => [r.id, r.imageUrl]));

  return tracks.map((track) => (track.imageUrl ? track : { ...track, imageUrl: artById.get(track.id) ?? null }));
}
