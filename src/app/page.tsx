import type { ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Shelf, type ShelfItem } from "@/components/Shelf";
import { PostCard } from "@/components/PostCard";
import { FeedTV, type FeedTvClip } from "@/components/FeedTV";
import { FollowingToggle } from "@/components/FollowingToggle";
import { OrbyBot } from "@/components/OrbyBot";
import { NewsletterSubscribeForm } from "@/components/NewsletterSubscribeForm";
import { getTopTracks, getValidAccessToken } from "@/lib/spotify";
import { getTrendingTracks } from "@/lib/lastfm";
import { searchVideos } from "@/lib/youtube";
import { fillMissingArt } from "@/lib/musicArt";
import { getUpcomingMoviesAndTv } from "@/lib/tmdb";
import type { MediaType } from "@/lib/media";
import { getAllSiteText } from "@/lib/siteContent";
import { getPublishedIssues } from "@/lib/newsletter";
import { getSiteFlags } from "@/lib/siteFlags";
import { ARTIST_PLATFORM_LABELS, type ArtistPlatform } from "@/lib/artistPlatforms";
import { Stars } from "@/components/Stars";
import { CoverArt } from "@/components/CoverArt";

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

type StatusRow = {
  username: string;
  status_media_type: MediaType;
  status_title: string;
  status_artist: string | null;
};

type ClubRow = {
  id: string;
  name: string;
  avatar_url: string | null;
};

type ArtistPostRow = {
  id: string;
  artist_name: string;
  platform: ArtistPlatform;
  description: string | null;
  profiles: { username: string } | null;
};

type BannerAdRow = {
  id: string;
  artist_name: string;
  link_url: string | null;
  image_url: string | null;
  message: string | null;
  slot_type: string;
};

// Renders as a real link when the spotlight has one, or a plain
// non-clickable container when it doesn't (link is optional on submission).
function BannerLink({
  href,
  className,
  children,
}: {
  href: string | null;
  className: string;
  children: ReactNode;
}) {
  if (!href) return <div className={className}>{children}</div>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {children}
    </a>
  );
}

function isWithinLastWeek(iso: string) {
  return Date.now() - new Date(iso).getTime() <= 7 * 24 * 60 * 60 * 1000;
}

const POST_COLUMNS =
  "id, user_id, media_type, title, body, rating, created_at, artist, cover_url, spotify_track_id, youtube_video_id";

// A failed select here comes back as null data, which silently renders as an
// empty feed - exactly how a missing column once emptied the whole homepage.
// Say so in the log instead of swallowing it.
async function fetchFeedPosts(supabase: Awaited<ReturnType<typeof createClient>>): Promise<PostRow[]> {
  const { data, error } = await supabase
    .from("posts")
    .select(`${POST_COLUMNS}, profiles!posts_user_id_fkey(username, avatar_url, is_verified)`)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<PostRow[]>();

  if (error) {
    console.error(`[feed] posts query failed: ${error.message}`);
    return [];
  }
  return data ?? [];
}

// Feed TV is only worth showing with something on it. Members' own clips
// come first; anything left over is filled from the tracks currently
// charting, labelled as such so it never reads as a member's post.
const FEEDTV_TARGET_CLIPS = 4;
const FEEDTV_FILL_CACHE_SECONDS = 6 * 60 * 60;

async function fillFeedTvLineup(
  clips: FeedTvClip[],
  tracks: { id: string; name: string; artist: string }[]
): Promise<FeedTvClip[]> {
  const missing = FEEDTV_TARGET_CLIPS - clips.length;
  if (missing <= 0) return clips;

  const found = await Promise.all(
    tracks.slice(0, missing).map(async (track) => {
      const [video] = await searchVideos(`${track.name} ${track.artist} official video`, 1, {
        revalidateSeconds: FEEDTV_FILL_CACHE_SECONDS,
      });
      if (!video) return null;
      return {
        id: `chart-${video.id}`,
        title: track.name,
        artist: track.artist,
        youtubeVideoId: video.id,
        username: null,
        postId: null,
      } satisfies FeedTvClip;
    })
  );

  const seen = new Set(clips.map((clip) => clip.youtubeVideoId));
  for (const clip of found) {
    if (!clip || seen.has(clip.youtubeVideoId)) continue;
    seen.add(clip.youtubeVideoId);
    clips.push(clip);
  }
  return clips;
}


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
    posts,
    postsCount,
    { data: likeRows },
    { data: commentRows },
    trendingTracks,
    upcomingMovies,
    { data: statusRows },
    { data: clubRows },
    { data: memberRows },
    { data: artistPostRows },
    { data: allBannerAdRows },
    siteText,
    newsletterIssues,
    siteFlags,
  ] = await Promise.all([
    fetchFeedPosts(supabase),
    supabase.from("posts").select("id", { count: "exact", head: true }),
    supabase.from("likes").select("post_id, user_id"),
    supabase.from("comments").select("post_id"),
    getTrendingTracks(50),
    getUpcomingMoviesAndTv(6),
    supabase
      .from("profiles")
      .select("username, status_media_type, status_title, status_artist")
      .not("status_media_type", "is", null)
      .gte("status_updated_at", new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
      .order("status_updated_at", { ascending: false })
      .limit(8)
      .returns<StatusRow[]>(),
    supabase
      .from("clubs")
      .select("id, name, avatar_url")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(4)
      .returns<ClubRow[]>(),
    supabase.from("club_members").select("club_id"),
    supabase
      .from("artist_posts")
      .select("id, artist_name, platform, description, profiles(username)")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(4)
      .returns<ArtistPostRow[]>(),
    supabase
      .from("banner_ads")
      .select("id, artist_name, link_url, image_url, message, slot_type")
      .eq("status", "approved")
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("created_at", { ascending: true })
      .returns<BannerAdRow[]>(),
    getAllSiteText(supabase),
    getPublishedIssues(supabase),
    getSiteFlags(supabase),
  ]);

  const clubMemberCounts = new Map<string, number>();
  for (const row of memberRows ?? []) {
    clubMemberCounts.set(row.club_id, (clubMemberCounts.get(row.club_id) ?? 0) + 1);
  }
  const latestIssue = newsletterIssues[0] ?? null;

  // Each banner is submitted for one specific shape and only ever rotates
  // through the placement matching that shape. Rotates to a new pick every
  // 6 hours (4x/day) per placement, without needing a cron job.
  const allBanners = allBannerAdRows ?? [];
  const ROTATION_MS = 6 * 60 * 60 * 1000;
  const rotationSlot = Math.floor(Date.now() / ROTATION_MS);
  const pickAds = (slotType: string, count: number) => {
    const pool = allBanners.filter((b) => b.slot_type === slotType);
    if (pool.length === 0) return [];
    return Array.from({ length: Math.min(count, pool.length) }, (_, i) => pool[(rotationSlot + i) % pool.length]);
  };
  const heroAd = pickAds("hero", 1)[0] ?? null;
  const sidebarAds = pickAds("sidebar", 2);
  const wideAd = pickAds("wide", 1)[0] ?? null;
  const artistSpotlights = pickAds("feature", 2);

  let followedIds: Set<string> | null = null;
  if (user && followingOnly) {
    const { data: followRows } = await supabase
      .from("follows")
      .select("followed_id")
      .eq("follower_id", user.id);
    followedIds = new Set((followRows ?? []).map((r) => r.followed_id));
  }

  const allPosts = followedIds ? posts.filter((p) => followedIds!.has(p.user_id)) : posts;

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
      href: `/post/${p.id}`,
      rating: p.rating,
    }));

  const hotTakePost = allPosts.reduce<(typeof allPosts)[number] | null>((best, p) => {
    const score = (likeCounts.get(p.id) ?? 0) + (commentCounts.get(p.id) ?? 0);
    const bestScore = best ? (likeCounts.get(best.id) ?? 0) + (commentCounts.get(best.id) ?? 0) : -1;
    return score > bestScore ? p : best;
  }, null);
  const newFavePost = allPosts[0] ?? null;

  const FUN_FACTS = [
    "Every review you post can spin up a new fan club automatically.",
    "Feed TV's lineup is pulled straight from what the community's been posting.",
    "The Leaderboard is a lifetime tally - it never resets.",
    "Underground artists and filmmakers can post directly - no label or distributor needed.",
  ];
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % FUN_FACTS.length;
  const todayFunFact = FUN_FACTS[dayIndex];

  const SITE_LINKS: { heading: string; links: { label: string; href: string }[] }[] = [
    {
      heading: "Community",
      links: [
        { label: "Leaderboard", href: "/leaderboard" },
        { label: "Collections", href: "/collections" },
      ],
    },
    {
      heading: "Site",
      links: [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
      ],
    },
  ];

  const memberClips: FeedTvClip[] = [];
  const seenVideoIds = new Set<string>();
  for (const post of allPosts) {
    if (!post.youtube_video_id || seenVideoIds.has(post.youtube_video_id)) continue;
    seenVideoIds.add(post.youtube_video_id);
    memberClips.push({
      id: post.id,
      title: post.title,
      artist: post.artist,
      youtubeVideoId: post.youtube_video_id,
      username: post.profiles?.username ?? "unknown",
      postId: post.id,
    });
    if (memberClips.length >= 10) break;
  }
  const feedTvClips = await fillFeedTvLineup(memberClips, trendingTracks);

  return (
    <>
      <div className="page-header">
        <h1>{siteText.feed_heading}</h1>
        <div className="tagline">{siteText.feed_tagline}</div>
      </div>

      {siteFlags.homepage_ad_hero &&
        (heroAd ? (
          <BannerLink href={heroAd.link_url} className="banner-slot-hero">
            <span className="banner-slot-tag">Discover</span>
            {heroAd.image_url ? (
              <img src={heroAd.image_url} alt={heroAd.artist_name} />
            ) : (
              <div className="banner-slot-hero-fallback">
                <b>{heroAd.artist_name}</b>
                {heroAd.message && <span>{heroAd.message}</span>}
              </div>
            )}
          </BannerLink>
        ) : (
          <Link href="/advertise" className="banner-slot-hero">
            <span className="banner-slot-tag">Discover</span>
            <div className="banner-slot-hero-fallback">
              <b>Advertise on Feedback</b>
              <span>Get your music or film in front of the community - free for now.</span>
            </div>
          </Link>
        ))}

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

      {siteFlags.homepage_wrapped && (
        <Link href="/wrapped" className="wrapped-promo-banner">
          <span className="wrapped-promo-label">Your Wrapped</span>
          <span className="wrapped-promo-text">See your year in reviews - updates all year, not just December.</span>
          <span className="wrapped-promo-cta">View Wrapped ▸</span>
        </Link>
      )}

      {siteFlags.homepage_new_releases && upcomingMovies.length > 0 && (
        <div className="panel">
          <div className="panel-head tabbed">
            <span className="panel-head-tab">
              <span className="tab-the">the</span>
              <span className="tab-main">New Movies &amp; TV</span>
            </span>
            <Link href="/new-releases" className="see-all">
              See All ▸
            </Link>
          </div>
          <div className="release-grid" style={{ padding: 16 }}>
            {upcomingMovies.map((item) => (
              <div className="release-card" key={item.id}>
                <CoverArt imageUrl={item.imageUrl} seed={item.id} />
                <div className="release-title">{item.title}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {siteFlags.homepage_ads && (
        <div className="feature-row">
          {artistSpotlights.length > 0 ? (
            artistSpotlights.map((spotlight) => (
              <BannerLink href={spotlight.link_url} className="feature-banner" key={spotlight.id}>
                <span
                  className="feature-banner-bg"
                  style={{
                    backgroundImage: spotlight.image_url
                      ? `linear-gradient(180deg, rgba(10, 12, 20, 0.2), rgba(10, 12, 20, 0.72)), url(${spotlight.image_url})`
                      : "linear-gradient(160deg, #7b2ff7, #f107a3)",
                  }}
                />
                <span className="label">{spotlight.artist_name}</span>
                <span className="sub">{spotlight.message || "Artist Spotlight"}</span>
              </BannerLink>
            ))
          ) : (
            <Link href="/advertise" className="feature-banner">
              <span className="feature-banner-bg" style={{ backgroundImage: "linear-gradient(160deg, #7b2ff7, #f107a3)" }} />
              <span className="label">Artist Spotlight</span>
              <span className="sub">Feature an artist here - submit at /advertise</span>
            </Link>
          )}
        </div>
      )}

      <div className="content-grid">
        <div className="left-col">
          <FeedTV clips={feedTvClips} />

          {spotifyConnected && (
            <Shelf
              title="On Repeat"
              items={onRepeat}
              emptyMessage="Play something on Spotify and it'll show up here."
            />
          )}
          <Shelf title="Now Watching" items={nowWatching} />

          {siteFlags.homepage_ad_wide &&
            (wideAd ? (
              <BannerLink href={wideAd.link_url} className="banner-slot-wide">
                <span className="banner-slot-tag">Discover</span>
                {wideAd.image_url ? (
                  <img src={wideAd.image_url} alt={wideAd.artist_name} />
                ) : (
                  <div className="banner-slot-wide-fallback">
                    <b>{wideAd.artist_name}</b>
                    {wideAd.message && <span>{wideAd.message}</span>}
                  </div>
                )}
              </BannerLink>
            ) : (
              <Link href="/advertise" className="banner-slot-wide">
                <span className="banner-slot-tag">Discover</span>
                <div className="banner-slot-wide-fallback">
                  <b>Advertise on Feedback</b>
                  <span>Get your music or film in front of the community - free for now.</span>
                </div>
              </Link>
            ))}

          {siteFlags.homepage_creators && (
            <div className="panel">
              <div className="panel-head tabbed">
                <span className="panel-head-tab">
                  <span className="tab-the">the</span>
                  <span className="tab-main">Underground Creators</span>
                </span>
                <Link href="/artists" className="see-all">
                  See All ▸
                </Link>
              </div>
              <div className="panel-body flush">
                {(artistPostRows ?? []).length === 0 ? (
                  <div className="empty-state" style={{ padding: 16 }}>
                    No creator posts yet - underground artists and filmmakers can{" "}
                    <Link href="/artists">share their work here</Link>.
                  </div>
                ) : (
                  (artistPostRows ?? []).map((post) => (
                    <div className="chat-row" key={post.id}>
                      <b>{post.artist_name}</b>{" "}
                      <span className={`badge ${post.platform}`}>{ARTIST_PLATFORM_LABELS[post.platform]}</span>
                      {post.description && <span> - {post.description}</span>}
                      <span className="ts">shared by {post.profiles?.username ?? "unknown"}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
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

          {siteFlags.homepage_clubs && (
            <div className="right-now-widget">
              <div className="right-now-tab">CLUBS</div>
              <div className="right-now-body">
                {(clubRows ?? []).length === 0 ? (
                  <div className="right-now-ad-fallback">
                    <b>Start a fan club</b>
                    <span>Rally people around an artist, movie, or show you love.</span>
                    <Link href="/clubs" className="see-all" style={{ marginTop: 6 }}>
                      Start one ▸
                    </Link>
                  </div>
                ) : (
                  <div className="club-chip-list">
                    {(clubRows ?? []).map((club) => (
                      <Link href={`/clubs/${club.id}`} key={club.id} className="club-chip">
                        <img src={club.avatar_url || "/avatars/preset-1.svg"} alt="" className="club-chip-avatar" />
                        <span className="club-chip-name">{club.name}</span>
                        <span className="club-chip-count">
                          {clubMemberCounts.get(club.id) ?? 0} member
                          {(clubMemberCounts.get(club.id) ?? 0) === 1 ? "" : "s"}
                        </span>
                      </Link>
                    ))}
                    <Link href="/clubs" className="see-all club-chip-see-all">
                      See all clubs ▸
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {siteFlags.homepage_ad_sidebar &&
            (sidebarAds.length > 0 ? (
              sidebarAds.map((ad) => (
                <BannerLink href={ad.link_url} className="banner-slot" key={ad.id}>
                  <span className="banner-slot-tag">Discover</span>
                  {ad.image_url ? (
                    <img src={ad.image_url} alt={ad.artist_name} />
                  ) : (
                    <div className="banner-slot-fallback">
                      <b>{ad.artist_name}</b>
                      {ad.message && <span>{ad.message}</span>}
                    </div>
                  )}
                </BannerLink>
              ))
            ) : (
              <Link href="/advertise" className="banner-slot">
                <span className="banner-slot-tag">Discover</span>
                <div className="banner-slot-fallback">
                  <b>Advertise on Feedback</b>
                  <span>Get your music or film in front of the community - free for now.</span>
                </div>
              </Link>
            ))}

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
                        {post.profiles?.username ?? "unknown"} · <Stars rating={post.rating} />
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {siteFlags.homepage_newsletter && (
            <div className="panel">
              <div className="panel-head tabbed">
                <span className="panel-head-tab">
                  <span className="tab-the">the</span>
                  <span className="tab-main">Newsletter</span>
                </span>
                <Link href="/newsletter" className="see-all">
                  See All ▸
                </Link>
              </div>
              <div className="panel-body">
                {latestIssue && (
                  <Link href={`/newsletter/${latestIssue.id}`} className="site-links-link" style={{ marginBottom: 10 }}>
                    <span>{latestIssue.title}</span>
                    <span className="dm-inbox-time">{latestIssue.issue_date}</span>
                  </Link>
                )}
                <p className="field-hint" style={{ marginTop: latestIssue ? 10 : 0, marginBottom: 10 }}>
                  Weekly picks on new releases and underground artists - no account required.
                </p>
                <NewsletterSubscribeForm />
              </div>
            </div>
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
                        {post.profiles?.username ?? "unknown"} · <Stars rating={post.rating} />
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
              <div>{(clubRows ?? []).length} clubs formed</div>
              <div>{(artistPostRows ?? []).length} underground creators featured</div>
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
