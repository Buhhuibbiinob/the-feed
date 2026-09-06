import { searchVideos } from "@/lib/youtube";
import type { FeedTvClip } from "@/components/FeedTV";

// Feed TV is only worth showing with something on it. Members' own clips
// come first; anything left over is filled from the tracks currently
// charting, labelled as such so it never reads as a member's post.
//
// Lifted out of the homepage when the player moved to Discover: two
// pages building the same lineup two different ways is how they drift.
export const FEEDTV_TARGET_CLIPS = 4;
const FEEDTV_FILL_CACHE_SECONDS = 6 * 60 * 60;

export async function fillFeedTvLineup(
  clips: FeedTvClip[],
  tracks: { id: string; name: string; artist: string }[]
): Promise<FeedTvClip[]> {
  const missing = FEEDTV_TARGET_CLIPS - clips.length;
  if (missing <= 0) return clips;

  const found = await Promise.all(
    tracks.slice(0, missing).map(async (track) => {
      const [video] = await searchVideos(`${track.name} ${track.artist} official video`, 1, {
        revalidateSeconds: FEEDTV_FILL_CACHE_SECONDS,
      });
      if (!video) return null;
      return {
        id: `chart-${video.id}`,
        title: track.name,
        artist: track.artist,
        youtubeVideoId: video.id,
        username: null,
        postId: null,
      } satisfies FeedTvClip;
    })
  );

  const seen = new Set(clips.map((clip) => clip.youtubeVideoId));
  for (const clip of found) {
    if (!clip || seen.has(clip.youtubeVideoId)) continue;
    seen.add(clip.youtubeVideoId);
    clips.push(clip);
  }
  return clips;
}
