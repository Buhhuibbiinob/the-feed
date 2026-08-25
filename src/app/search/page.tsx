import Link from "next/link";
import { fetchPostReactions } from "@/lib/postReactions";
import { createClient } from "@/lib/supabase/server";
import { PostCard } from "@/components/PostCard";
import type { MediaType } from "@/lib/media";

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

type ProfileRow = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!query) {
    return (
      <div className="panel">
        <div className="panel-head">Search</div>
        <div className="panel-body">
          <p className="empty-state">Search for a review, artist, movie, show, or username.</p>
        </div>
      </div>
    );
  }

  const escaped = query.replace(/[%_]/g, (c) => `\\${c}`);
  const pattern = `%${escaped}%`;

  const [{ data: postRows }, { data: profileRows }, { data: likeRows }, { data: commentRows }] =
    await Promise.all([
      supabase
        .from("posts")
        .select(
          "id, user_id, media_type, title, body, rating, created_at, artist, cover_url, spotify_track_id, youtube_video_id, profiles!posts_user_id_fkey(username)"
        )
        .or(`title.ilike.${pattern},artist.ilike.${pattern},body.ilike.${pattern}`)
        .order("created_at", { ascending: false })
        .limit(30)
        .returns<PostRow[]>(),
      supabase
        .from("profiles")
        .select("id, username, avatar_url, bio")
        .ilike("username", pattern)
        .limit(20)
        .returns<ProfileRow[]>(),
      supabase.from("likes").select("post_id, user_id"),
      supabase.from("comments").select("post_id"),
    ]);

  const posts = postRows ?? [];
  const profiles = profileRows ?? [];

  const likeCounts = new Map<string, number>();
  const likedByMe = new Set<string>();
  for (const like of likeRows ?? []) {
    likeCounts.set(like.post_id, (likeCounts.get(like.post_id) ?? 0) + 1);
    if (user && like.user_id === user.id) likedByMe.add(like.post_id);
  }
  const commentCounts = new Map<string, number>();
  for (const comment of commentRows ?? []) {
    commentCounts.set(comment.post_id, (commentCounts.get(comment.post_id) ?? 0) + 1);
  }

  // Reaction tags for everything rendered on this page. Fetched here
  // rather than inside PostCard so one query covers the whole list.
  const reactionsByPost = await fetchPostReactions(
    supabase,
    posts.map((p) => p.id),
    user?.id ?? null
  );

  return (
    <>
      {profiles.length > 0 && (
        <div className="panel">
          <div className="panel-head">People</div>
          <div className="panel-body flush">
            {profiles.map((p) => (
              <Link href={`/profile/${p.username}`} key={p.id} className="search-person-row">
                <img src={p.avatar_url || "/avatars/preset-1.svg"} alt="" className="search-person-avatar" />
                <div className="search-person-info">
                  <b>{p.username}</b>
                  {p.bio && <span>{p.bio}</span>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">Reviews</div>
        <div className="panel-body flush">
          {posts.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>
              {profiles.length === 0
                ? `No results for "${query}".`
                : `No reviews match "${query}".`}
            </div>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={{
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
                }}
                currentUserId={user?.id ?? null}
                liked={likedByMe.has(post.id)}
                likeCount={likeCounts.get(post.id) ?? 0}
                commentCount={commentCounts.get(post.id) ?? 0}
                reactions={reactionsByPost.get(post.id)}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
