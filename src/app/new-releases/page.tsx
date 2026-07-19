import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { coverGradient } from "@/lib/cover";
import { getNewReleases } from "@/lib/spotify";

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
  const [releases, { data: posts }] = await Promise.all([
    getNewReleases(40),
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
        <div className="panel-head">New Releases</div>
        <div className="release-grid">
          {releases.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>
              Couldn&apos;t load new releases from Spotify right now — try again later.
            </div>
          ) : (
            releases.map((album) => (
              <a
                href={`https://open.spotify.com/album/${album.id}`}
                target="_blank"
                rel="noreferrer"
                className="release-card"
                key={album.id}
              >
                <div
                  className="release-cover"
                  style={{
                    backgroundImage: album.imageUrl ? `url(${album.imageUrl})` : coverGradient(album.id),
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                <div className="release-title">{album.name}</div>
                <div className="release-sub">{album.artist}</div>
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
