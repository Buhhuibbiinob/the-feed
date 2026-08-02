import { getAppAccessToken, searchTracks } from "@/lib/spotify";

// Last.fm's trending chart often has no real cover art for a track. This
// backfills missing art by searching Spotify's catalog (much more complete
// artwork coverage) for the same name/artist, using the app-level
// client-credentials token so it works for every visitor regardless of
// whether they've connected Spotify.
export async function fillMissingArt<T extends { id: string; name: string; artist: string; imageUrl: string | null }>(
  tracks: T[]
): Promise<T[]> {
  const missing = tracks.filter((t) => !t.imageUrl);
  if (missing.length === 0) return tracks;

  let accessToken: string;
  try {
    accessToken = await getAppAccessToken();
  } catch {
    return tracks;
  }

  const results = await Promise.all(
    missing.map(async (track) => {
      try {
        const found = await searchTracks(accessToken, `${track.name} ${track.artist}`, 1);
        return { id: track.id, imageUrl: found[0]?.imageUrl ?? null };
      } catch {
        return { id: track.id, imageUrl: null };
      }
    })
  );
  const artById = new Map(results.map((r) => [r.id, r.imageUrl]));

  return tracks.map((track) => (track.imageUrl ? track : { ...track, imageUrl: artById.get(track.id) ?? null }));
}
