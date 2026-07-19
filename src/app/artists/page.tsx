import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { ArtistPostForm } from "@/components/ArtistPostForm";
import { ARTIST_PLATFORM_LABELS, type ArtistPlatform } from "@/lib/artistPlatforms";
import { getAllSiteText } from "@/lib/siteContent";

type ArtistPostRow = {
  id: string;
  artist_name: string;
  platform: ArtistPlatform;
  description: string | null;
  status: "active" | "banned";
  created_at: string;
  profiles: { username: string; is_verified_artist: boolean } | null;
};

export const metadata = { title: "Underground Creators — the feed" };

export default async function ArtistsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = user ? await isAdmin(supabase, user.id) : false;

  let query = supabase
    .from("artist_posts")
    .select("id, artist_name, platform, description, status, created_at, profiles(username, is_verified_artist)")
    .order("created_at", { ascending: false });
  if (!admin) query = query.eq("status", "active");

  const [{ data: postRows }, siteText] = await Promise.all([
    query.returns<ArtistPostRow[]>(),
    getAllSiteText(supabase),
  ]);
  const posts = postRows ?? [];

  return (
    <>
      <div className="page-header">
        <h1>{siteText.artists_heading}</h1>
        <div className="tagline">{siteText.artists_tagline}</div>
      </div>

      <div className="panel">
        <div className="panel-head">
          Share Your Work
          {!user && (
            <span style={{ fontWeight: 400, fontSize: 11 }}>
              {" — "}
              <Link href="/sign-in">Sign in</Link> to post.
            </span>
          )}
        </div>
        <div className="panel-body">{user && <ArtistPostForm />}</div>
      </div>

      <div className="panel">
        <div className="panel-head">All Posts</div>
        <div className="panel-body flush">
          {posts.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>{siteText.artists_empty}</div>
          ) : (
            posts.map((post) => (
              <Link href={`/artists/${post.id}`} className="artist-post-row" key={post.id}>
                <div className="artist-post-row-head">
                  <span className={`badge ${post.platform}`}>{ARTIST_PLATFORM_LABELS[post.platform]}</span>
                  <span className="artist-post-row-name">
                    {post.artist_name}
                    {post.profiles?.is_verified_artist && (
                      <span className="verified-check" title="Verified creator">
                        ✓
                      </span>
                    )}
                  </span>
                  {post.status === "banned" && <span className="club-row-joined">Banned</span>}
                </div>
                {post.description && <div className="artist-post-row-desc">{post.description}</div>}
                <div className="artist-post-row-meta">
                  posted by {post.profiles?.username ?? "unknown"}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  );
}
