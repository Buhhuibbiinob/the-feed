import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PostCard, type PostCardData } from "@/components/PostCard";
import type { MediaType } from "@/lib/media";
import { deleteCollection, removePostFromCollection } from "@/app/actions/collections";

type CollectionRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  profiles: { username: string } | null;
};

type PostRow = {
  id: string;
  user_id: string;
  media_type: MediaType;
  title: string;
  body: string;
  rating: number | null;
  created_at: string;
  artist: string | null;
  cover_url: string | null;
  spotify_track_id: string | null;
  youtube_video_id: string | null;
  profiles: { username: string } | null;
};

function toCardData(post: PostRow): PostCardData {
  return {
    id: post.id,
    userId: post.user_id,
    mediaType: post.media_type,
    title: post.title,
    body: post.body,
    rating: post.rating,
    createdAt: post.created_at,
    artist: post.artist,
    coverUrl: post.cover_url,
    spotifyTrackId: post.spotify_track_id,
    youtubeVideoId: post.youtube_video_id,
    username: post.profiles?.username ?? "unknown",
  };
}

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: collectionData } = await supabase
    .from("collections")
    .select("id, user_id, name, description, profiles!collections_user_id_fkey(username)")
    .eq("id", id)
    .maybeSingle();
  const collection = collectionData as CollectionRow | null;
  if (!collection) notFound();

  const { data: linkRows } = await supabase
    .from("collection_posts")
    .select("post_id")
    .eq("collection_id", id);
  const postIds = (linkRows ?? []).map((r) => r.post_id);

  const [{ data: postRows }, { data: likeRows }, { data: commentRows }] = await Promise.all([
    postIds.length
      ? supabase
          .from("posts")
          .select(
            "id, user_id, media_type, title, body, rating, created_at, artist, cover_url, spotify_track_id, youtube_video_id, profiles!posts_user_id_fkey(username)"
          )
          .in("id", postIds)
          .returns<PostRow[]>()
      : Promise.resolve({ data: [] as PostRow[] }),
    supabase.from("likes").select("post_id, user_id"),
    supabase.from("comments").select("post_id"),
  ]);

  const posts = postRows ?? [];

  const likeCounts = new Map<string, number>();
  const likedByMe = new Set<string>();
  for (const like of likeRows ?? []) {
    likeCounts.set(like.post_id, (likeCounts.get(like.post_id) ?? 0) + 1);
    if (user && like.user_id === user.id) likedByMe.add(like.post_id);
  }
  const commentCounts = new Map<string, number>();
  for (const c of commentRows ?? []) {
    commentCounts.set(c.post_id, (commentCounts.get(c.post_id) ?? 0) + 1);
  }

  const isOwner = user?.id === collection.user_id;

  return (
    <>
      <div className="page-header">
        <h1>{collection.name}</h1>
        <div className="tagline">
          {collection.description ? collection.description + " · " : ""}
          by {collection.profiles?.username ?? "unknown"}
        </div>
      </div>

      {isOwner && (
        <div className="panel">
          <div className="panel-body" style={{ display: "flex", justifyContent: "flex-end" }}>
            <form action={deleteCollection}>
              <input type="hidden" name="collection_id" value={collection.id} />
              <button type="submit" className="comment-action danger">
                Delete Collection
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">Posts</div>
        <div className="panel-body flush">
          {posts.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>
              No posts saved to this collection yet.
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.id}>
                <PostCard
                  post={toCardData(post)}
                  currentUserId={user?.id ?? null}
                  liked={likedByMe.has(post.id)}
                  likeCount={likeCounts.get(post.id) ?? 0}
                  commentCount={commentCounts.get(post.id) ?? 0}
                />
                {isOwner && (
                  <form action={removePostFromCollection} style={{ padding: "0 16px 12px" }}>
                    <input type="hidden" name="collection_id" value={collection.id} />
                    <input type="hidden" name="post_id" value={post.id} />
                    <button type="submit" className="comment-action danger">
                      Remove from collection
                    </button>
                  </form>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <Link href="/collections" className="comment-action">
          ← All collections
        </Link>
      </div>
    </>
  );
}
