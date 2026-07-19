import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { coverGradient } from "@/lib/cover";
import { getTrendingTracks } from "@/lib/lastfm";
import { getUpcomingMoviesAndTv } from "@/lib/tmdb";

type PostRow = {
  id: string;
  title: string;
  artist: string | null;
  cover_url: string | null;
  rating: number | null;
  created_at: string;
  profiles: { username: string } | null;
};

function stars(rating: number | null) {
  if (!rating) return null;
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

export const metadata = { title: "New Releases — the feed" };

export default async function NewReleasesPage() {
  const supabase = await createClient();
  const [tracks, movies, { data: posts }] = await Promise.all([
    getTrendingTracks(20),
    getUpcomingMoviesAndTv(20),
    supabase
      .from("posts")
      .select("id, title, artist, cover_url, rating, created_at, profiles!posts_user_id_fkey(username)")
      .eq("media_type", "music")
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<PostRow[]>(),
  ]);

  const reviews = posts ?? [];

  return (
    <>
      <div className="panel">
        <div className="panel-head">Trending Music</div>
        <div className="release-grid">
          {tracks.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>
              Couldn&apos;t load trending tracks right now — try again later.
            </div>
          ) : (
            tracks.map((track) => (
              <a
                href={`https://www.last.fm/music/${encodeURIComponent(track.artist)}/_/${encodeURIComponent(track.name)}`}
                target="_blank"
                rel="noreferrer"
                className="release-card"
                key={track.id}
              >
                <div
                  className="release-cover"
                  style={{
                    backgroundImage: track.imageUrl ? `url(${track.imageUrl})` : coverGradient(track.id),
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                <div className="release-title">{track.name}</div>
                <div className="release-sub">{track.artist}</div>
              </a>
            ))
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">New Movies &amp; TV</div>
        <div className="release-grid">
          {movies.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>
              Couldn&apos;t load new movies/TV right now — try again later.
            </div>
          ) : (
            movies.map((item) => (
              <a
                href={`https://www.themoviedb.org/${item.mediaType}/${item.id.replace(/^(movie|tv)-/, "")}`}
                target="_blank"
                rel="noreferrer"
                className="release-card"
                key={item.id}
              >
                <div
                  className="release-cover"
                  style={{
                    backgroundImage: item.imageUrl ? `url(${item.imageUrl})` : coverGradient(item.id),
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                <div className="release-title">{item.title}</div>
                <div className="release-sub">{item.date ?? (item.mediaType === "tv" ? "TV" : "Movie")}</div>
              </a>
            ))
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Recent Reviews</div>
        <div className="release-grid">
          {reviews.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>
              No music reviews yet — be the first to post one.
            </div>
          ) : (
            reviews.map((post) => (
              <Link href={`/post/${post.id}`} className="release-card" key={post.id}>
                <div
                  className="release-cover"
                  style={{
                    backgroundImage: post.cover_url ? `url(${post.cover_url})` : coverGradient(post.id),
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                <div className="release-title">{post.title}</div>
                <div className="release-sub">{post.artist || post.profiles?.username || "unknown"}</div>
                {post.rating && <div className="release-stars">{stars(post.rating)}</div>}
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  );
}
