import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PostCard } from "@/components/PostCard";
import { FollowButton } from "@/components/FollowButton";
import { AvatarPicker } from "@/components/AvatarPicker";
import { ProfileCustomize } from "@/components/ProfileCustomize";

type ProfileRow = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  banner_url: string | null;
  created_at: string;
};

type PostRow = {
  id: string;
  user_id: string;
  media_type: "music" | "movie" | "tv";
  title: string;
  body: string;
  rating: number | null;
  created_at: string;
  artist: string | null;
  cover_url: string | null;
};

const MEDIA_LABELS: Record<PostRow["media_type"], string> = {
  music: "Music",
  movie: "Movies",
  tv: "TV",
};

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, bio, banner_url, created_at")
    .eq("username", username)
    .maybeSingle();

  const profile = profileData as ProfileRow | null;
  if (!profile) notFound();

  const [
    { data: postRows },
    { count: followerCount },
    { count: followingCount },
    { data: likeRows },
    { data: commentRows },
  ] = await Promise.all([
    supabase
      .from("posts")
      .select("id, user_id, media_type, title, body, rating, created_at, artist, cover_url")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .returns<PostRow[]>(),
    supabase
      .from("follows")
      .select("follower_id", { count: "exact", head: true })
      .eq("followed_id", profile.id),
    supabase
      .from("follows")
      .select("followed_id", { count: "exact", head: true })
      .eq("follower_id", profile.id),
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
  for (const comment of commentRows ?? []) {
    commentCounts.set(comment.post_id, (commentCounts.get(comment.post_id) ?? 0) + 1);
  }

  const breakdown: Record<PostRow["media_type"], number> = { music: 0, movie: 0, tv: 0 };
  for (const post of posts) breakdown[post.media_type]++;

  const isOwnProfile = user?.id === profile.id;

  let isFollowing = false;
  if (user && !isOwnProfile) {
    const { data: followRow } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("followed_id", profile.id)
      .maybeSingle();
    isFollowing = !!followRow;
  }

  return (
    <>
      <div
        className="panel profile-head"
        style={
          profile.banner_url
            ? {
                backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.55)), url(${profile.banner_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <div className="panel-body profile-head-body">
          <img
            src={profile.avatar_url || "/avatars/preset-1.svg"}
            alt=""
            className="profile-avatar"
          />
          <div className="profile-info">
            <div className="profile-username">{profile.username}</div>
            {profile.bio && <div className="profile-bio">{profile.bio}</div>}
            <div className="profile-counts">
              <span>{posts.length} reviews</span>
              <span>{followerCount ?? 0} followers</span>
              <span>{followingCount ?? 0} following</span>
            </div>
            <div className="profile-actions">
              {isOwnProfile ? (
                <>
                  <AvatarPicker />
                  <ProfileCustomize bio={profile.bio} />
                </>
              ) : user ? (
                <FollowButton
                  followedId={profile.id}
                  username={profile.username}
                  following={isFollowing}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Stats</div>
        <div className="stats-body">
          {(Object.keys(MEDIA_LABELS) as PostRow["media_type"][]).map((mt) => (
            <div key={mt}>
              {breakdown[mt]} {MEDIA_LABELS[mt]} review{breakdown[mt] === 1 ? "" : "s"}
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Reviews</div>
        <div className="panel-body flush">
          {posts.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>
              No reviews yet.
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
                  username: profile.username,
                }}
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
