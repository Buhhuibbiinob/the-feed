import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { selectPosts } from "@/lib/postQuery";
import { PostCard, type PostCardData } from "@/components/PostCard";
import { AddToQueueButton } from "@/components/AddToQueueButton";
import { averageRating, type WorkRow } from "@/lib/works";
import { MEDIA_LABELS, type MediaType } from "@/lib/media";
import { genreLabel } from "@/lib/genres";
import { isAdmin } from "@/lib/admin";
import { Stars } from "@/components/Stars";

type PostRow = {
  id: string;
  user_id: string;
  media_type: MediaType;
  genre: string | null;
  title: string;
  body: string;
  rating: number | null;
  created_at: string;
  artist: string | null;
  cover_url: string | null;
  spotify_track_id: string | null;
  youtube_video_id: string | null;
  profiles: { username: string } | { username: string }[] | null;
};

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: work } = await supabase
    .from("works")
    .select("id, work_key, media_type, title, artist, cover_url")
    .eq("id", id)
    .maybeSingle<WorkRow>();
  if (!work) notFound();

  const posts = await selectPosts<PostRow>(
    (columns) =>
      supabase
        .from("posts")
        .select(`${columns}, profiles!posts_user_id_fkey(username)`)
        .eq("work_id", id)
        .order("created_at", { ascending: false })
        .returns<PostRow[]>(),
    "id, user_id, media_type, genre, title, body, rating, created_at, artist, cover_url, spotify_track_id, youtube_video_id"
  );

  const [{ data: likeRows }, { data: commentRows }] = await Promise.all([
    supabase.from("likes").select("post_id, user_id"),
    supabase.from("comments").select("post_id"),
  ]);

  const likeCounts = new Map<string, number>();
  const likedByViewer = new Set<string>();
  for (const row of (likeRows ?? []) as { post_id: string; user_id: string }[]) {
    likeCounts.set(row.post_id, (likeCounts.get(row.post_id) ?? 0) + 1);
    if (user && row.user_id === user.id) likedByViewer.add(row.post_id);
  }
  const commentCounts = new Map<string, number>();
  for (const row of (commentRows ?? []) as { post_id: string }[]) {
    commentCounts.set(row.post_id, (commentCounts.get(row.post_id) ?? 0) + 1);
  }

  const { average, count } = averageRating(posts.map((p) => p.rating));
  const viewerIsAdmin = user ? await isAdmin(supabase, user.id) : false;
  // The genre nobody had a place to show: whatever most of its reviewers
  // called it, rather than whichever review happens to be newest.
  const genreTally = new Map<string, number>();
  for (const post of posts) {
    if (post.genre) genreTally.set(post.genre, (genreTally.get(post.genre) ?? 0) + 1);
  }
  const topGenre = [...genreTally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const toCard = (post: PostRow): PostCardData => {
    const author = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
    return {
      id: post.id,
      mediaType: post.media_type,
      genre: post.genre,
      title: post.title,
      body: post.body,
      rating: post.rating,
      createdAt: post.created_at,
      artist: post.artist,
      coverUrl: post.cover_url,
      spotifyTrackId: post.spotify_track_id,
      youtubeVideoId: post.youtube_video_id,
      username: author?.username ?? "someone",
      userId: post.user_id,
    };
  };

  return (
    <>
      <div className="panel">
        <div className="panel-head">{MEDIA_LABELS[work.media_type]}</div>
        <div className="panel-body">
          <div className="work-head">
            {work.cover_url ? (
              <img src={work.cover_url} alt="" className="work-cover" />
            ) : (
              <span className="work-cover blank" aria-hidden="true" />
            )}
            <div className="work-facts">
              <h1 className="work-title">{work.title}</h1>
              {work.artist && <div className="work-artist">{work.artist}</div>}
              {/* The number this table was built to make possible. */}
              <div className="work-score">
                {count > 0 ? (
                  <>
                    <Stars rating={Math.round(average)} />
                    <b>{average.toFixed(1)}</b>
                    <span className="sub">
                      from {count} rating{count === 1 ? "" : "s"}
                    </span>
                  </>
                ) : (
                  <span className="sub">
                    {posts.length === 0
                      ? "No reviews yet."
                      : `${posts.length} review${posts.length === 1 ? "" : "s"}, none of them rated.`}
                  </span>
                )}
              </div>
              {topGenre && <span className="badge genre">{genreLabel(topGenre)}</span>}
              <div className="work-actions">
                <Link
                  className="btn"
                  href={`/post/new?type=${work.media_type}&title=${encodeURIComponent(work.title)}${
                    work.artist ? `&artist=${encodeURIComponent(work.artist)}` : ""
                  }`}
                >
                  Write your own
                </Link>
                {user && (
                  <AddToQueueButton
                    mediaType={work.media_type}
                    title={work.title}
                    artist={work.artist}
                    coverUrl={work.cover_url}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          {posts.length} review{posts.length === 1 ? "" : "s"}
        </div>
        <div className="panel-body flush">
          {posts.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>
              Nobody has reviewed this yet.
            </div>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={toCard(post)}
                currentUserId={user?.id ?? null}
                viewerIsAdmin={viewerIsAdmin}
                liked={likedByViewer.has(post.id)}
                likeCount={likeCounts.get(post.id) ?? 0}
                commentCount={commentCounts.get(post.id) ?? 0}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
