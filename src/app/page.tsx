import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PostForm } from "@/components/PostForm";
import { Shelf, type ShelfItem } from "@/components/Shelf";
import { PostCard } from "@/components/PostCard";
import { getTopTracks, getValidAccessToken, getNewReleases } from "@/lib/spotify";
import type { MediaType } from "@/lib/media";
import { getAllSiteText } from "@/lib/siteContent";

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

type ChatPreviewRow = {
  id: string;
  body: string;
  created_at: string;
  profiles: { username: string } | null;
};

type StatusRow = {
  username: string;
  status_media_type: MediaType;
  status_title: string;
  status_artist: string | null;
};

function stars(rating: number | null) {
  if (!rating) return null;
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function isWithinLastWeek(iso: string) {
  return Date.now() - new Date(iso).getTime() <= 7 * 24 * 60 * 60 * 1000;
}

function topByEngagement(
  posts: PostRow[],
  mediaType: PostRow["media_type"],
  likeCounts: Map<string, number>,
  commentCounts: Map<string, number>
) {
  const score = (p: PostRow) => (likeCounts.get(p.id) ?? 0) + (commentCounts.get(p.id) ?? 0);
  return posts
    .filter((p) => p.media_type === mediaType)
    .sort((a, b) => score(b) - score(a) || (b.rating ?? 0) - (a.rating ?? 0))
    .at(0);
}

const bannerCopy: Record<PostRow["media_type"], { eyebrow: string; empty: string }> = {
  music: { eyebrow: "Liked by the Community", empty: "No music reviews yet" },
  movie_tv: { eyebrow: "Editor's Pick", empty: "No movie or TV reviews yet" },
};

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const followingOnly = filter === "following";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: posts },
    { data: chatRows },
    postsCount,
    profilesCount,
    chatCount,
    { data: likeRows },
    { data: commentRows },
    spotifyNewReleases,
    { data: statusRows },
    siteText,
  ] = await Promise.all([
    supabase
      .from("posts")
      .select(
        "id, user_id, media_type, title, body, rating, created_at, artist, cover_url, spotify_track_id, youtube_video_id, profiles!posts_user_id_fkey(username)"
      )
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<PostRow[]>(),
    supabase
      .from("chat_messages")
      .select("id, body, created_at, profiles(username)")
      .order("created_at", { ascending: false })
      .limit(3)
      .returns<ChatPreviewRow[]>(),
    supabase.from("posts").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("chat_messages").select("id", { count: "exact", head: true }),
    supabase.from("likes").select("post_id, user_id"),
    supabase.from("comments").select("post_id"),
    getNewReleases(10),
    supabase
      .from("profiles")
      .select("username, status_media_type, status_title, status_artist")
      .not("status_media_type", "is", null)
      .gte("status_updated_at", new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
      .order("status_updated_at", { ascending: false })
      .limit(8)
      .returns<StatusRow[]>(),
    getAllSiteText(supabase),
  ]);

  let followedIds: Set<string> | null = null;
  if (user && followingOnly) {
    const { data: followRows } = await supabase
      .from("follows")
      .select("followed_id")
      .eq("follower_id", user.id);
    followedIds = new Set((followRows ?? []).map((r) => r.followed_id));
  }

  const allPosts = followedIds ? (posts ?? []).filter((p) => followedIds!.has(p.user_id)) : posts ?? [];

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

  let spotifyConnected = false;
  let onRepeat: ShelfItem[] = [];
  if (user) {
    const { data: spotifyAccount } = await supabase
      .from("spotify_accounts")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    spotifyConnected = !!spotifyAccount;

    if (spotifyConnected) {
      const accessToken = await getValidAccessToken(supabase, user.id);
      if (accessToken) {
        const tracks = await getTopTracks(accessToken, 10);
        onRepeat = tracks.map((track) => ({
          id: track.id,
          title: track.name,
          subtitle: track.artist,
          imageUrl: track.imageUrl ?? undefined,
        }));
      }
    }
  }

  const reviewerCounts = new Map<string, number>();
  for (const post of allPosts) {
    const name = post.profiles?.username;
    if (!name) continue;
    reviewerCounts.set(name, (reviewerCounts.get(name) ?? 0) + 1);
  }
  const topReviewers = [...reviewerCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topThisWeek = allPosts
    .filter((p) => p.rating && isWithinLastWeek(p.created_at))
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 5);

  const topTracks = allPosts
    .filter((p) => p.media_type === "music" && p.rating)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 5);

  const newReleases: ShelfItem[] = spotifyNewReleases.map((album) => ({
    id: album.id,
    title: album.name,
    subtitle: album.artist,
    imageUrl: album.imageUrl ?? undefined,
  }));

  const nowWatching: ShelfItem[] = allPosts
    .filter((p) => p.media_type === "movie_tv")
    .slice(0, 10)
    .map((p) => ({
      id: p.id,
      title: p.title,
      subtitle: p.profiles?.username ?? "unknown",
      poster: true,
      imageUrl: p.cover_url ?? undefined,
    }));

  const banners = (["music", "movie_tv"] as const).map((mediaType) => {
    const top = topByEngagement(allPosts, mediaType, likeCounts, commentCounts);
    return { mediaType, top, ...bannerCopy[mediaType] };
  });

  return (
    <>
      <div className="page-header">
        <h1>{siteText.feed_heading}</h1>
        <div className="tagline">{siteText.feed_tagline}</div>
      </div>

      <div className="feature-row">
        {banners.map(({ mediaType, top, eyebrow, empty }) => {
          const brandGradient =
            mediaType === "music"
              ? "linear-gradient(160deg, #3ee08a, #0f7a3f)"
              : "linear-gradient(160deg, #ff5f8a, #a8123f)";
          return (
            <div
              className="feature-banner"
              key={mediaType}
              style={{
                backgroundImage: top?.cover_url
                  ? `linear-gradient(180deg, rgba(10, 12, 20, 0.2), rgba(10, 12, 20, 0.72)), url(${top.cover_url})`
                  : brandGradient,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <span className="label">{top ? top.title : eyebrow}</span>
              <span className="sub">{top ? `${eyebrow} · ${top.profiles?.username ?? "unknown"}` : empty}</span>
            </div>
          );
        })}
      </div>

      {spotifyConnected && (
        <Shelf
          title="On Repeat"
          items={onRepeat}
          emptyMessage="Play something on Spotify and it'll show up here."
        />
      )}
      <Shelf title="New Releases" items={newReleases} />
      <Shelf title="Now Watching" items={nowWatching} />

      <div className="content-grid">
        <div className="left-col">
          {user ? (
            <PostForm />
          ) : (
            <div className="panel">
              <div className="panel-head">Join the conversation</div>
              <div className="panel-body">
                <p>
                  <Link href="/sign-up">Create an account</Link> or{" "}
                  <Link href="/sign-in">sign in</Link> to post a review.
                </p>
              </div>
            </div>
          )}

          <div className="panel">
            <div className="panel-head">
              Recent Reviews
              {user && (
                <span className="feed-filter">
                  <Link href="/" className={!followingOnly ? "active" : ""}>
                    All
                  </Link>
                  <Link href="/?filter=following" className={followingOnly ? "active" : ""}>
                    Following
                  </Link>
                </span>
              )}
            </div>
            <div className="panel-body flush">
              {allPosts.length === 0 ? (
                <div className="empty-state" style={{ padding: 16 }}>
                  {followingOnly
                    ? "No reviews yet from people you follow."
                    : "No reviews yet — be the first to post one."}
                </div>
              ) : (
                allPosts.map((post) => (
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
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <div className="right-col">
          {statusRows && statusRows.length > 0 && (
            <div className="panel">
              <div className="panel-head">Live Now</div>
              <div className="side-list">
                {statusRows.map((row) => (
                  <div className="row" key={row.username}>
                    <span className="num">{row.status_media_type === "music" ? "🎧" : "📺"}</span>
                    <div className="info">
                      <b>{row.username}</b>
                      <span>
                        {row.status_title}
                        {row.status_artist && <> — {row.status_artist}</>}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="panel">
            <div className="panel-head">Today&apos;s Top Tracks</div>
            <div className="side-list">
              {topTracks.length === 0 ? (
                <div className="empty-state">No music reviews yet.</div>
              ) : (
                topTracks.map((post, i) => (
                  <div className="row" key={post.id}>
                    <span className="num">{i + 1}</span>
                    <div className="info">
                      <b>{post.title}</b>
                      <span>
                        {post.profiles?.username ?? "unknown"} · {stars(post.rating)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">Top Reviews This Week</div>
            <div className="side-list">
              {topThisWeek.length === 0 ? (
                <div className="empty-state">Nothing rated this week yet.</div>
              ) : (
                topThisWeek.map((post, i) => (
                  <div className="row" key={post.id}>
                    <span className="num">{i + 1}</span>
                    <div className="info">
                      <b>{post.title}</b>
                      <span>
                        {post.profiles?.username ?? "unknown"} · {stars(post.rating)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">Most Active Reviewers</div>
            <div className="side-list">
              {topReviewers.length === 0 ? (
                <div className="empty-state">No reviews yet.</div>
              ) : (
                topReviewers.map(([name, count], i) => (
                  <div className="row" key={name}>
                    <span className="num">{i + 1}</span>
                    <div className="info">
                      <b>{name}</b>
                      <span>
                        {count} review{count === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      <div className="bottom-row">
        <div className="panel">
          <div className="panel-head">Community Stats</div>
          <div className="stats-body">
            <div>{postsCount.count ?? 0} reviews posted</div>
            <div>{profilesCount.count ?? 0} members</div>
            <div>{chatCount.count ?? 0} chat messages sent</div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            Live Chat
            <Link href="/chat" className="see-all">
              See All ▸
            </Link>
          </div>
          <div className="chat-preview-body">
            {!chatRows || chatRows.length === 0 ? (
              <div className="empty-state">No messages yet.</div>
            ) : (
              [...chatRows].reverse().map((row) => (
                <div className="chat-row" key={row.id}>
                  <b>{row.profiles?.username ?? "unknown"}:</b> {row.body}
                  <span className="ts">{timeAgo(row.created_at)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
