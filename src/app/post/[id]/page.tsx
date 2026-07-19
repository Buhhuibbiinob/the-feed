import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PostCard } from "@/components/PostCard";
import { CommentSection, type CommentData } from "@/components/CommentSection";
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

type CommentRow = {
  id: string;
  post_id: string;
  user_id: string;
  parent_comment_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  profiles: { username: string } | null;
};

function buildCommentTree(rows: CommentRow[]): CommentData[] {
  const top: CommentData[] = [];
  const byId = new Map<string, CommentData>();

  for (const row of rows) {
    byId.set(row.id, {
      id: row.id,
      postId: row.post_id,
      userId: row.user_id,
      body: row.body,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      username: row.profiles?.username ?? "unknown",
      replies: [],
    });
  }

  for (const row of rows) {
    const node = byId.get(row.id)!;
    if (row.parent_comment_id) {
      byId.get(row.parent_comment_id)?.replies.push(node);
    } else {
      top.push(node);
    }
  }

  return top;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: post } = await supabase
    .from("posts")
    .select("title, artist, body, profiles!posts_user_id_fkey(username)")
    .eq("id", id)
    .maybeSingle<{
      title: string;
      artist: string | null;
      body: string;
      profiles: { username: string } | null;
    }>();

  if (!post) return {};

  const username = post.profiles?.username ?? "someone";
  const title = post.artist ? `${post.title} — ${post.artist}` : post.title;
  const description = `Reviewed by ${username}: ${post.body}`;

  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: postData } = await supabase
    .from("posts")
    .select(
      "id, user_id, media_type, title, body, rating, created_at, artist, cover_url, spotify_track_id, youtube_video_id, profiles!posts_user_id_fkey(username)"
    )
    .eq("id", id)
    .maybeSingle();

  const post = postData as PostRow | null;
  if (!post) notFound();

  const [{ data: commentRows }, { count: likeCount }] = await Promise.all([
    supabase
      .from("comments")
      .select(
        "id, post_id, user_id, parent_comment_id, body, created_at, updated_at, profiles(username)"
      )
      .eq("post_id", id)
      .order("created_at", { ascending: true })
      .returns<CommentRow[]>(),
    supabase.from("likes").select("post_id", { count: "exact", head: true }).eq("post_id", id),
  ]);

  let liked = false;
  if (user) {
    const { data: myLike } = await supabase
      .from("likes")
      .select("post_id")
      .eq("post_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    liked = !!myLike;
  }

  const comments = buildCommentTree(commentRows ?? []);

  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <Link href="/" className="comment-action">
          ← Back to Feed
        </Link>
      </div>

      <PostCard
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
        liked={liked}
        likeCount={likeCount ?? 0}
        commentCount={comments.reduce((n, c) => n + 1 + c.replies.length, 0)}
        hideCommentLink
      />

      <CommentSection postId={post.id} comments={comments} currentUserId={user?.id ?? null} />
    </>
  );
}
