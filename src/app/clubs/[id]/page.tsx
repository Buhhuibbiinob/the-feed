import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PostCard, type PostCardData } from "@/components/PostCard";
import { MEDIA_LABELS, type MediaType } from "@/lib/media";
import { joinClub, leaveClub } from "@/app/actions/clubs";

type ClubRow = { id: string; media_type: MediaType; name: string };

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

export default async function ClubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: clubData } = await supabase
    .from("clubs")
    .select("id, media_type, name")
    .eq("id", id)
    .maybeSingle();
  const club = clubData as ClubRow | null;
  if (!club) notFound();

  const [{ data: postRows }, { count: memberCount }, { data: likeRows }, { data: commentRows }] =
    await Promise.all([
      supabase
        .from("posts")
        .select(
          "id, user_id, media_type, title, body, rating, created_at, artist, cover_url, spotify_track_id, youtube_video_id, profiles!posts_user_id_fkey(username)"
        )
        .eq("club_id", id)
        .order("created_at", { ascending: false })
        .returns<PostRow[]>(),
      supabase.from("club_members").select("user_id", { count: "exact", head: true }).eq("club_id", id),
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

  let isMember = false;
  if (user) {
    const { data: myMembership } = await supabase
      .from("club_members")
      .select("user_id")
      .eq("club_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    isMember = !!myMembership;
  }

  return (
    <>
      <div className="page-header">
        <h1>{club.name}</h1>
        <div className="tagline">
          {MEDIA_LABELS[club.media_type]} fan club · {memberCount ?? 0} member{(memberCount ?? 0) === 1 ? "" : "s"}
        </div>
      </div>

      <div className="panel">
        <div className="panel-body" style={{ display: "flex", justifyContent: "flex-end" }}>
          {!user ? (
            <Link href="/sign-in" className="btn">
              Sign in to join
            </Link>
          ) : isMember ? (
            <form action={leaveClub}>
              <input type="hidden" name="club_id" value={club.id} />
              <button type="submit" className="btn">
                Leave Club
              </button>
            </form>
          ) : (
            <form action={joinClub}>
              <input type="hidden" name="club_id" value={club.id} />
              <button type="submit" className="btn">
                Join Club
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Posts</div>
        <div className="panel-body flush">
          {posts.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>
              No posts in this club yet.
            </div>
          ) : (
            posts.map((post) => (
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
