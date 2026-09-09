import type { SupabaseClient } from "@supabase/supabase-js";
import { searchVideosDetailed } from "@/lib/youtube";
import { lookupSpotifyTrack } from "@/lib/spotify";
import { lookupTrack } from "@/lib/catalogue";

// Giving the reviews already written the player they never got.
//
// A review only shows a player when the row carries a video id, and
// until recently only one path ever put one there: picking a song out of
// the search box. Everything started from Discover, the Crate or a shelf
// - which is most reviews - was saved with nothing, and every film
// review was saved with nothing regardless, because the lookup only ever
// considered music.
//
// Posting handles that now. These are the ones already in the database,
// and they cannot fix themselves: nothing at render time is allowed to
// spend a YouTube search, because a feed of twenty would be two thousand
// units per page view and the day's whole allowance is ten thousand.
//
// So it is a job somebody runs, in small bites, deliberately. The cost
// is visible before it is spent and the answer is written to the row, so
// each review costs at most one search once, ever.

/** How many posts one run will look at. Small on purpose: see above. */
export const BATCH = 10;

type Row = {
  id: string;
  title: string;
  artist: string | null;
  media_type: string | null;
  cover_url: string | null;
  youtube_video_id: string | null;
  spotify_track_id: string | null;
};

export type BackfillReport = {
  looked: number;
  videos: number;
  spotify: number;
  covers: number;
  /** Posts still without a player after this run, across the whole site. */
  remaining: number;
};

/**
 * Fills in players and covers for up to BATCH reviews.
 *
 * Newest first, because those are the ones people are looking at. Run it
 * again for the next ten.
 *
 * Written with the service-role client: this touches everybody's posts,
 * and the update policy is auth.uid() = user_id, which no admin
 * satisfies.
 */
export async function backfillPlayers(admin: SupabaseClient): Promise<BackfillReport> {
  const { data, error } = await admin
    .from("posts")
    .select("id, title, artist, media_type, cover_url, youtube_video_id, spotify_track_id")
    .in("media_type", ["music", "movie_tv"])
    .is("youtube_video_id", null)
    .is("spotify_track_id", null)
    .order("created_at", { ascending: false })
    .limit(BATCH)
    .returns<Row[]>();
  if (error || !data) return { looked: 0, videos: 0, spotify: 0, covers: 0, remaining: 0 };

  const report: BackfillReport = {
    looked: data.length,
    videos: 0,
    spotify: 0,
    covers: 0,
    remaining: 0,
  };

  for (const row of data) {
    const title = row.title?.trim();
    if (!title) continue;
    const artist = row.artist?.trim() ?? "";
    const film = row.media_type === "movie_tv";

    const update: Record<string, string> = {};

    const { videos } = await searchVideosDetailed(
      film ? `${title} trailer` : artist ? `${artist} ${title}` : title,
      1,
      // Somebody is standing at the admin page waiting for this, and it
      // is a job they chose to run rather than a page refreshing itself.
      { priority: "user" }
    ).catch(() => ({ videos: [] }));
    const videoId = videos[0]?.id;
    if (videoId) {
      update.youtube_video_id = videoId;
      report.videos++;
      // A film's cover is its trailer's thumbnail, free.
      if (!row.cover_url && film) {
        update.cover_url = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        report.covers++;
      }
    } else if (!film) {
      // No video today - a spent quota, or nothing on YouTube. Spotify
      // costs nothing and has no daily cap.
      const found = await lookupSpotifyTrack(title, artist).catch(() => null);
      if (found?.trackId) {
        update.spotify_track_id = found.trackId;
        report.spotify++;
      }
    }

    if (!row.cover_url && !film) {
      const found = await lookupTrack(title, artist).catch(() => null);
      if (found?.artworkUrl) {
        update.cover_url = found.artworkUrl;
        report.covers++;
      }
    }

    if (Object.keys(update).length > 0) {
      await admin.from("posts").update(update).eq("id", row.id);
    }
  }

  // How many are left, so the person running this knows whether to press
  // it again and roughly what it will cost.
  const { count } = await admin
    .from("posts")
    .select("id", { count: "exact", head: true })
    .in("media_type", ["music", "movie_tv"])
    .is("youtube_video_id", null)
    .is("spotify_track_id", null);
  report.remaining = count ?? 0;
  return report;
}
