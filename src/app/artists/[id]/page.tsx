import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { deleteArtistPost, reportArtistPost } from "@/app/actions/artistPosts";
import { ARTIST_PLATFORM_LABELS, type ArtistPlatform } from "@/lib/artistPlatforms";
import { adminBanArtistPost, adminUnbanArtistPost, adminDeleteArtistPost } from "@/app/actions/admin";
import { ArtistPostComments, type ArtistCommentData } from "@/components/ArtistPostComments";

type ArtistPostRow = {
  id: string;
  user_id: string;
  artist_name: string;
  platform: ArtistPlatform;
  link_url: string;
  description: string | null;
  status: "active" | "banned";
  created_at: string;
  profiles: { username: string; is_verified_artist: boolean } | null;
};

type CommentRow = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles: { username: string } | null;
};

export default async function ArtistPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: postData }, { data: commentRows }] = await Promise.all([
    supabase
      .from("artist_posts")
      .select(
        "id, user_id, artist_name, platform, link_url, description, status, created_at, profiles(username, is_verified_artist)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("artist_post_comments")
      .select("id, user_id, body, created_at, profiles(username)")
      .eq("artist_post_id", id)
      .order("created_at", { ascending: true })
      .returns<CommentRow[]>(),
  ]);

  const post = postData as ArtistPostRow | null;
  if (!post) notFound();

  const admin = user ? await isAdmin(supabase, user.id) : false;
  if (post.status === "banned" && !admin) notFound();

  const comments: ArtistCommentData[] = (commentRows ?? []).map((c) => ({
    id: c.id,
    userId: c.user_id,
    username: c.profiles?.username ?? "unknown",
    body: c.body,
    createdAt: c.created_at,
  }));

  const isOwner = user?.id === post.user_id;

  return (
    <>
      <div className="page-header">
        <h1>
          {post.artist_name}
          {post.profiles?.is_verified_artist && (
            <span className="verified-check" title="Verified creator">
              ✓
            </span>
          )}
        </h1>
        <div className="tagline">
          posted by {post.profiles?.username ?? "unknown"}
          {post.status === "banned" && " · banned"}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className={`badge ${post.platform}`}>{ARTIST_PLATFORM_LABELS[post.platform]}</span>
        </div>
        <div className="panel-body">
          {post.description && <p>{post.description}</p>}
          <p>
            <a href={post.link_url} target="_blank" rel="noopener noreferrer" className="btn">
              Open on {ARTIST_PLATFORM_LABELS[post.platform]}
            </a>
          </p>
          <div className="chat-msg-actions">
            {isOwner && (
              <form action={deleteArtistPost} className="inline-form">
                <input type="hidden" name="post_id" value={post.id} />
                <button type="submit" className="comment-action danger">
                  Delete
                </button>
              </form>
            )}
            {user && !isOwner && (
              <form action={reportArtistPost} className="inline-form">
                <input type="hidden" name="post_id" value={post.id} />
                <button type="submit" className="comment-action">
                  Report
                </button>
              </form>
            )}
            {admin && (
              <>
                {post.status === "active" ? (
                  <form action={adminBanArtistPost} className="inline-form">
                    <input type="hidden" name="post_id" value={post.id} />
                    <button type="submit" className="comment-action danger">
                      Admin: Ban post
                    </button>
                  </form>
                ) : (
                  <form action={adminUnbanArtistPost} className="inline-form">
                    <input type="hidden" name="post_id" value={post.id} />
                    <button type="submit" className="comment-action">
                      Admin: Unban post
                    </button>
                  </form>
                )}
                <form action={adminDeleteArtistPost} className="inline-form">
                  <input type="hidden" name="post_id" value={post.id} />
                  <button type="submit" className="comment-action danger">
                    Admin: Delete
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      <ArtistPostComments
        postId={post.id}
        comments={comments}
        currentUserId={user?.id ?? null}
        isAdmin={admin}
      />

      <p>
        <Link href="/artists">← Back to Underground Creators</Link>
      </p>
    </>
  );
}
