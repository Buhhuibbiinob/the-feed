import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PostCard, type PostCardData } from "@/components/PostCard";
import { OrbyBot, type OrbyCandidate } from "@/components/OrbyBot";
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

export const metadata = { title: "Recs — the feed" };

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

export default async function RecsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: posts }, { data: likeRows }, { data: commentRows }] = await Promise.all([
    supabase
      .from("posts")
      .select(
        "id, user_id, media_type, title, body, rating, created_at, artist, cover_url, spotify_track_id, youtube_video_id, profiles!posts_user_id_fkey(username)"
      )
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<PostRow[]>(),
    supabase.from("likes").select("post_id, user_id"),
    supabase.from("comments").select("post_id"),
  ]);

  const allPosts = posts ?? [];

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

  const trending = allPosts
    .filter((p) => p.user_id !== user?.id)
    .map((post) => ({
      post,
      score: (likeCounts.get(post.id) ?? 0) * 2 + (commentCounts.get(post.id) ?? 0) + (post.rating ?? 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((x) => x.post);

  let forYou: PostRow[] = [];
  if (user) {
    const [{ data: myPosts }, { data: followRows }] = await Promise.all([
      supabase.from("posts").select("media_type, rating").eq("user_id", user.id),
      supabase.from("follows").select("followed_id").eq("follower_id", user.id),
    ]);

    const typeScore = new Map<string, number>();
    for (const p of myPosts ?? []) {
      if (p.rating && p.rating >= 4) {
        typeScore.set(p.media_type, (typeScore.get(p.media_type) ?? 0) + 1);
      }
    }
    const favoriteTypes = new Set([...typeScore.keys()]);
    const followedIds = new Set((followRows ?? []).map((r) => r.followed_id));

    forYou = allPosts
      .filter((p) => p.user_id !== user.id && (p.rating ?? 0) >= 4)
      .filter((p) => followedIds.has(p.user_id) || favoriteTypes.has(p.media_type))
      .sort((a, b) => {
        const aFollowed = followedIds.has(a.user_id) ? 1 : 0;
        const bFollowed = followedIds.has(b.user_id) ? 1 : 0;
        if (aFollowed !== bFollowed) return bFollowed - aFollowed;
        return (b.rating ?? 0) - (a.rating ?? 0);
      })
      .slice(0, 10);
  }

  const orbySeen = new Set<string>();
  const orbyCandidates: OrbyCandidate[] = [...forYou, ...trending, ...allPosts.filter((p) => (p.rating ?? 0) >= 4)]
    .filter((p) => {
      if (orbySeen.has(p.id)) return false;
      orbySeen.add(p.id);
      return true;
    })
    .map((p) => ({
      id: p.id,
      title: p.title,
      artist: p.artist,
      mediaType: p.media_type,
      username: p.profiles?.username ?? "unknown",
      rating: p.rating,
    }))
    .slice(0, 30);

  return (
    <>
      <OrbyBot candidates={orbyCandidates} />

      <div className="panel">
        <div className="panel-head">For You</div>
        <div className="panel-body flush">
          {!user ? (
            <div className="empty-state" style={{ padding: 16 }}>
              <Link href="/sign-in">Sign in</Link> to get recommendations based on your ratings and who you
              follow.
            </div>
          ) : forYou.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>
              Rate a few reviews or follow some reviewers and we&apos;ll start recommending things here.
            </div>
          ) : (
            forYou.map((post) => (
              <PostCard
                key={post.id}
                post={toCardData(post)}
                currentUserId={user?.id ?? null}
                liked={likedByMe.has(post.id)}
                likeCount={likeCounts.get(post.id) ?? 0}
                commentCount={commentCounts.get(post.id) ?? 0}
              />
            ))
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Trending</div>
        <div className="panel-body flush">
          {trending.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>
              Nothing trending yet.
            </div>
          ) : (
            trending.map((post) => (
              <PostCard
                key={post.id}
                post={toCardData(post)}
                currentUserId={user?.id ?? null}
                liked={likedByMe.has(post.id)}
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
