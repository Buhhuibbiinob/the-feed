import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Shelf, type ShelfItem } from "@/components/Shelf";
import { PostCard } from "@/components/PostCard";
import { FeedTV, type FeedTvClip } from "@/components/FeedTV";
import { FollowingToggle } from "@/components/FollowingToggle";
import { OrbyBot } from "@/components/OrbyBot";
import { getTopTracks, getValidAccessToken } from "@/lib/spotify";
import { getTrendingTracks } from "@/lib/lastfm";
import { fillMissingArt } from "@/lib/musicArt";
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
  profiles: { username: string; avatar_url: string | null; is_verified: boolean } | null;
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

type BannerAdRow = {
  id: string;
  artist_name: string;
  link_url: string;
  image_url: string | null;
  message: string | null;
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
    chatCount,
    { data: likeRows },
    { data: commentRows },
    trendingTracks,
    { data: statusRows },
    { data: bannerAdRows },
    siteText,
  ] = await Promise.all([
    supabase
      .from("posts")
      .select(
        "id, user_id, media_type, title, body, rating, created_at, artist, cover_url, spotify_track_id, youtube_video_id, profiles!posts_user_id_fkey(username, avatar_url, is_verified)"
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
    supabase.from("chat_messages").select("id", { count: "exact", head: true }),
    supabase.from("likes").select("post_id, user_id"),
    supabase.from("comments").select("post_id"),
    getTrendingTracks(50),
    supabase
      .from("profiles")
      .select("username, status_media_type, status_title, status_artist")
      .not("status_media_type", "is", null)
      .gte("status_updated_at", new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
      .order("status_updated_at", { ascending: false })
      .limit(8)
      .returns<StatusRow[]>(),
    supabase
      .from("banner_ads")
      .select("id, artist_name, link_url, image_url, message")
      .eq("status", "approved")
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("created_at", { ascending: true })
      .returns<BannerAdRow[]>(),
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

  const reviewerCounts = new Map<string, { count: number; avatarUrl: string | null }>();
  for (const post of allPosts) {
    const name = post.profiles?.username;
    if (!name) continue;
    const existing = reviewerCounts.get(name);
    reviewerCounts.set(name, {
      count: (existing?.count ?? 0) + 1,
      avatarUrl: existing?.avatarUrl ?? post.profiles?.avatar_url ?? null,
    });
  }
  const topReviewers = [...reviewerCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 7);

  const topThisWeek = allPosts
    .filter((p) => p.rating && isWithinLastWeek(p.created_at))
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 5);

  const topTracks = allPosts
    .filter((p) => p.media_type === "music" && p.rating)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 5);

  // Last.fm's global chart is often dominated by a single mega-popular
  // artist charting several tracks at once - cap it at 2 per artist so the
  // shelf reads as a mix instead of one artist's whole discography.
  const seenArtistCounts = new Map<string, number>();
  const diverseTracks = trendingTracks.filter((track) => {
    const count = seenArtistCounts.get(track.artist) ?? 0;
    if (count >= 2) return false;
    seenArtistCounts.set(track.artist, count + 1);
    return true;
  });
  const trendingTracksWithArt = await fillMissingArt(diverseTracks.slice(0, 10));
  const newReleases: ShelfItem[] = trendingTracksWithArt.map((track) => ({
    id: track.id,
    title: track.name,
    subtitle: track.artist,
    imageUrl: track.imageUrl ?? undefined,
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

  const hotTakePost = allPosts.reduce<(typeof allPosts)[number] | null>((best, p) => {
    const score = (likeCounts.get(p.id) ?? 0) + (commentCounts.get(p.id) ?? 0);
    const bestScore = best ? (likeCounts.get(best.id) ?? 0) + (commentCounts.get(best.id) ?? 0) : -1;
    return score > bestScore ? p : best;
  }, null);
  const newFavePost = allPosts[0] ?? null;

  const FUN_FACTS = [
    "Every review you post can spin up a new fan club automatically.",
    "Feed TV's lineup is pulled straight from what the community's been posting.",
    "Your Wrapped recap updates all year long, not just in December.",
    "The Leaderboard is a lifetime tally - it never resets.",
    "Ad slots in the sidebar rotate every 6 hours, so check back for new ones.",
  ];
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % FUN_FACTS.length;
  const todayFunFact = FUN_FACTS[dayIndex];

  const SITE_LINKS: { heading: string; links: { label: string; href: string }[] }[] = [
    {
      heading: "Community",
      links: [
        { label: "Leaderboard", href: "/leaderboard" },
        { label: "Clubs", href: "/clubs" },
        { label: "Creators", href: "/artists" },
        { label: "Collections", href: "/collections" },
      ],
    },
    {
      heading: "Discover",
      links: [
        { label: "New Releases", href: "/new-releases" },
        { label: "Recs", href: "/recs" },
        { label: "Wrapped", href: "/wrapped" },
        { label: "Newsletter", href: "/newsletter" },
        { label: "Live Chat", href: "/chat" },
      ],
    },
    {
      heading: "Site",
      links: [
        { label: "Advertise", href: "/advertise" },
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
      ],
    },
  ];

  const feedTvClips: FeedTvClip[] = [];
  const seenVideoIds = new Set<string>();
  for (const post of allPosts) {
    if (!post.youtube_video_id || seenVideoIds.has(post.youtube_video_id)) continue;
    seenVideoIds.add(post.youtube_video_id);
    feedTvClips.push({
      id: post.id,
      title: post.title,
      artist: post.artist,
      username: post.profiles?.username ?? "unknown",
      youtubeVideoId: post.youtube_video_id,
    });
    if (feedTvClips.length >= 10) break;
  }

  // Rotate through every approved banner in the pool - a new pick every 6
  // hours (4x/day), so a handful of images naturally cycle through the day
  // without needing a cron job or extra scheduling UI. Two ad spots pull
  // from different offsets in the rotation so they don't just repeat the
  // same image.
  const allBanners = bannerAdRows ?? [];
  const ROTATION_MS = 6 * 60 * 60 * 1000;
  const rotationSlot = Math.floor(Date.now() / ROTATION_MS);
  const sidebarBannerCount = Math.min(2, allBanners.length);
  const approvedBanners =
    allBanners.length === 0
      ? []
      : Array.from(
          { length: sidebarBannerCount },
          (_, i) => allBanners[(rotationSlot + i) % allBanners.length]
        );
  const midFeedBanner =
    allBanners.length === 0 ? null : allBanners[(rotationSlot + sidebarBannerCount) % allBanners.length];
  const topFeedBanner =
    allBanners.length === 0 ? null : allBanners[(rotationSlot + sidebarBannerCount + 1) % allBanners.length];
  const upcomingBanner =
    allBanners.length === 0 ? null : allBanners[(rotationSlot + sidebarBannerCount + 2) % allBanners.length];

  return (
    <>
      <div className="page-header">
        <h1>{siteText.feed_heading}</h1>
        <div className="tagline">{siteText.feed_tagline}</div>
      </div>

      <div className="theslap-top-grid">
        <div className="right-now-widget">
          <div className="right-now-tab">ADVERTISEMENT</div>
          <div className="right-now-body right-now-ad">
            {upcomingBanner ? (
              <a
                href={upcomingBanner.link_url}
                target="_blank"
                rel="noreferrer"
                className="right-now-ad-link"
              >
                {upcomingBanner.image_url ? (
                  <img src={upcomingBanner.image_url} alt={upcomingBanner.artist_name} />
                ) : (
                  <div className="right-now-ad-fallback">
                    <b>{upcomingBanner.artist_name}</b>
                    {upcomingBanner.message && <span>{upcomingBanner.message}</span>}
                  </div>
                )}
              </a>
            ) : (
              <Link href="/advertise" className="right-now-ad-link">
                <div className="right-now-ad-fallback">
                  <b>Advertise on Feedback</b>
                  <span>Get your music or film in front of the community - free for now.</span>
                </div>
              </Link>
            )}
          </div>
        </div>
        <FeedTV clips={feedTvClips} heading={siteText.feedtv_heading} />
      </div>

      <div className="theslap-3col">
        {topReviewers.length > 0 && (
          <div className="spotlight-panel">
            <span className="spotlight-tag">Top Reviewer</span>
            <img
              src={topReviewers[0][1].avatarUrl || "/avatars/preset-1.svg"}
              alt=""
              className="spotlight-avatar"
            />
            <b className="spotlight-name">{topReviewers[0][0]}</b>
            <span className="spotlight-sub">
              {topReviewers[0][1].count} review{topReviewers[0][1].count === 1 ? "" : "s"} and counting
            </span>
          </div>
        )}
        <Shelf title="Trending Music" items={newReleases} />
        <OrbyBot />
      </div>

      <div className="fun-fact-banner">
        <span className="fun-fact-label">Did You Know</span>
        <span className="fun-fact-text">{todayFunFact}</span>
      </div>

      {topFeedBanner ? (
        <a href={topFeedBanner.link_url} target="_blank" rel="noreferrer" className="banner-slot-wide">
          <span className="banner-slot-tag">Sponsored</span>
          {topFeedBanner.image_url ? (
            <img src={topFeedBanner.image_url} alt={topFeedBanner.artist_name} />
          ) : (
            <div className="banner-slot-wide-fallback">
              <b>{topFeedBanner.artist_name}</b>
              {topFeedBanner.message && <span>{topFeedBanner.message}</span>}
            </div>
          )}
        </a>
      ) : (
        <Link href="/advertise" className="banner-slot-wide">
          <span className="banner-slot-tag">Sponsored</span>
          <div className="banner-slot-wide-fallback">
            <b>Advertise on Feedback</b>
            <span>Get your music or film in front of the community - free for now.</span>
          </div>
        </Link>
      )}

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

      <div className="content-grid">
        <div className="left-col">
          {spotifyConnected && (
            <Shelf
              title="On Repeat"
              items={onRepeat}
              emptyMessage="Play something on Spotify and it'll show up here."
            />
          )}
          <Shelf title="Now Watching" items={nowWatching} />

          {midFeedBanner ? (
            <a href={midFeedBanner.link_url} target="_blank" rel="noreferrer" className="banner-slot-wide">
              <span className="banner-slot-tag">Sponsored</span>
              {midFeedBanner.image_url ? (
                <img src={midFeedBanner.image_url} alt={midFeedBanner.artist_name} />
              ) : (
                <div className="banner-slot-wide-fallback">
                  <b>{midFeedBanner.artist_name}</b>
                  {midFeedBanner.message && <span>{midFeedBanner.message}</span>}
                </div>
              )}
            </a>
          ) : (
            <Link href="/advertise" className="banner-slot-wide">
              <span className="banner-slot-tag">Sponsored</span>
              <div className="banner-slot-wide-fallback">
                <b>Advertise on Feedback</b>
                <span>Get your music or film in front of the community - free for now.</span>
              </div>
            </Link>
          )}

          <div className="panel">
            <div className="panel-head tabbed">
              <span className="panel-head-tab">
                <span className="tab-the">the</span>
                <span className="tab-main">Recent Reviews</span>
              </span>
              {user && <FollowingToggle following={followingOnly} />}
            </div>
            <div className="panel-body flush">
              {allPosts.length === 0 ? (
                <div className="empty-state" style={{ padding: 16 }}>
                  {followingOnly
                    ? "No reviews yet from people you follow."
                    : "No reviews yet - be the first to post one."}
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
                      isVerified: post.profiles?.is_verified ?? false,
                    }}
                    currentUserId={user?.id ?? null}
                    liked={likedByMe.has(post.id)}
                    likeCount={likeCounts.get(post.id) ?? 0}
                    commentCount={commentCounts.get(post.id) ?? 0}
                    sticker={
                      post.id === newFavePost?.id
                        ? "new"
                        : post.id === hotTakePost?.id
                          ? "hot"
                          : undefined
                    }
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <div className="right-col">
          <div className="panel new-post-card">
            <div className="panel-body">
              {user ? (
                <Link href="/post/new" className="btn new-post-btn">
                  + New Post
                </Link>
              ) : (
                <>
                  <p style={{ margin: "0 0 10px" }}>Have something to review?</p>
                  <Link href="/sign-up" className="btn new-post-btn">
                    Create Account
                  </Link>
                  <div className="auth-switch" style={{ textAlign: "center" }}>
                    <Link href="/sign-in">Sign in</Link>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="panel hot-pages-panel">
            <div className="panel-head tabbed">
              <span className="panel-head-tab">
                <span className="tab-the">the</span>
                <span className="tab-main">Most Active</span>
              </span>
            </div>
            {topReviewers.length === 0 ? (
              <div className="side-list">
                <div className="empty-state">No reviews yet.</div>
              </div>
            ) : (
              <div className="hot-pages-strip">
                {topReviewers.map(([name, { count, avatarUrl }]) => (
                  <div className="hot-pages-item" key={name}>
                    <div className="hot-pages-photo-wrap">
                      <img src={avatarUrl || "/avatars/preset-1.svg"} alt="" className="hot-pages-photo" />
                      <span className="hot-pages-badge">{count}</span>
                    </div>
                    <span className="hot-pages-name">{name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel">
            <div className="panel-head tabbed">
              <span className="panel-head-tab">
                <span className="tab-the">the</span>
                <span className="tab-main">Top Tracks</span>
              </span>
            </div>
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

          {approvedBanners.length > 0 ? (
            approvedBanners.map((b) => (
              <a href={b.link_url} target="_blank" rel="noreferrer" className="banner-slot" key={b.id}>
                <span className="banner-slot-tag">Sponsored</span>
                {b.image_url ? (
                  <img src={b.image_url} alt={b.artist_name} />
                ) : (
                  <div className="banner-slot-fallback">
                    <b>{b.artist_name}</b>
                    {b.message && <span>{b.message}</span>}
                  </div>
                )}
              </a>
            ))
          ) : (
            <Link href="/advertise" className="banner-slot">
              <span className="banner-slot-tag">Sponsored</span>
              <div className="banner-slot-fallback">
                <b>Advertise on Feedback</b>
                <span>Get your music or film in front of the community - free for now.</span>
              </div>
            </Link>
          )}

          {statusRows && statusRows.length > 0 && (
            <div className="panel">
              <div className="panel-head tabbed">
                <span className="panel-head-tab">
                  <span className="tab-the">the</span>
                  <span className="tab-main">Live Now</span>
                </span>
              </div>
              <div className="side-list">
                {statusRows.map((row) => (
                  <div className="row" key={row.username}>
                    <span className="num">{row.status_media_type === "music" ? "Music" : "TV"}</span>
                    <div className="info">
                      <b>{row.username}</b>
                      <span>
                        {row.status_title}
                        {row.status_artist && <> - {row.status_artist}</>}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="panel">
            <div className="panel-head tabbed">
              <span className="panel-head-tab">
                <span className="tab-the">the</span>
                <span className="tab-main">Top This Week</span>
              </span>
            </div>
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
            <div className="panel-head tabbed">
              <span className="panel-head-tab">
                <span className="tab-the">the</span>
                <span className="tab-main">Community Stats</span>
              </span>
            </div>
            <div className="stats-body">
              <div>{postsCount.count ?? 0} reviews posted</div>
              <div>{chatCount.count ?? 0} chat messages sent</div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head tabbed">
              <span className="panel-head-tab">
                <span className="tab-the">the</span>
                <span className="tab-main">Live Chat</span>
              </span>
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
      </div>

      <div className="panel site-links-panel">
        <div className="panel-head tabbed">
          <span className="panel-head-tab">
            <span className="tab-the">the</span>
            <span className="tab-main">Site Links</span>
          </span>
        </div>
        <div className="site-links-body">
          {SITE_LINKS.map((group) => (
            <div className="site-links-group" key={group.heading}>
              <b>{group.heading}</b>
              <div className="site-links-rows">
                {group.links.map((link) => (
                  <Link key={link.href} href={link.href} className="site-links-link">
                    <span>{link.label}</span>
                    <span className="site-links-chevron">›</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
