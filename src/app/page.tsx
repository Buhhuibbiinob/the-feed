import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Shelf, type ShelfItem } from "@/components/Shelf";
import { PostCard } from "@/components/PostCard";
import { FeedTV, type FeedTvClip } from "@/components/FeedTV";
import { FollowingToggle } from "@/components/FollowingToggle";
import { OrbyBot } from "@/components/OrbyBot";
import { getOrbyWishesLeft } from "@/app/actions/orby";
import { NewsletterSubscribeForm } from "@/components/NewsletterSubscribeForm";
import { getTopTracks, getValidAccessToken } from "@/lib/spotify";
import { getTrendingTracks } from "@/lib/lastfm";
import { searchVideos } from "@/lib/youtube";
import { fillMissingArt } from "@/lib/musicArt";
import { getUpcomingMoviesAndTv } from "@/lib/tmdb";
import { MEDIA_TYPES, MEDIA_FILTER_LABELS, type MediaType } from "@/lib/media";
import { highestBadge } from "@/lib/badges";
import { getAllSiteText } from "@/lib/siteContent";
import { getPublishedIssues } from "@/lib/newsletter";
import { getSiteFlags } from "@/lib/siteFlags";
import { isAdmin } from "@/lib/admin";
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

type LayoutBlock = { key: string; node: ReactNode };

/**
 * Orders the homepage's movable blocks. Seeded off the day number rather
 * than Math.random, which matters three ways: every visitor sees the same
 * page as each other, a refresh doesn't reshuffle it under someone
 * mid-scroll, and the server and client agree so React doesn't scream about
 * a hydration mismatch. It re-rolls on its own at midnight.
 *
 * Blocks that are conditionally rendered come in as null and are dropped, so
 * a hidden section can't leave a gap in the order.
 */
function orderBlocks(blocks: LayoutBlock[], shuffle: boolean): LayoutBlock[] {
  const present = blocks.filter((b) => b.node);
  if (!shuffle) return present;

  const ordered = [...present];
  let seed = Math.floor(Date.now() / 86_400_000);
  const next = () => {
    // Numerical Recipes LCG - small, deterministic, and good enough to
    // reorder eight cards.
    seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return seed / 4_294_967_296;
  };
  for (let i = ordered.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  }
  return ordered;
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
    // 62 posts exist and a cap of 50 was silently hiding the 12 oldest,
    // which were the earliest real member reviews. Raised well clear of
    // current volume; this wants real pagination before it grows much more.
    .limit(300)
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
  searchParams: Promise<{ filter?: string; type?: string; page?: string }>;
}) {
  const { filter, type, page } = await searchParams;
  const followingOnly = filter === "following";
  // Photography lives in the shared feed behind a filter rather than in its
  // own hub. At this volume a separate destination would just look empty,
  // which costs more than the tidier navigation gains.
  const typeFilter = MEDIA_TYPES.includes(type as MediaType) ? (type as MediaType) : null;

  // One builder for every feed link so the following filter, the category
  // and the page number always travel together. Page 1 is left out of the
  // URL so the plain "/" stays the canonical first page.
  const feedHref = (nextType: MediaType | null, nextPage: number) => {
    const params = new URLSearchParams();
    if (followingOnly) params.set("filter", "following");
    if (nextType) params.set("type", nextType);
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    return qs ? `/?${qs}#reviews` : "/#reviews";
  };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewerIsAdmin = user ? await isAdmin(supabase, user.id) : false;
  // One clock reading for the whole render, shared by the Live Now window
  // and the club activity labels, so "now" can't drift between them.
  const renderNow = Date.now();
  // Signed-out visitors have no personal count, so skip the query entirely.
  const orbyWishesLeft = user ? await getOrbyWishesLeft() : null;

  const [
    posts,
    postsCount,
    { data: likeRows },
    { data: commentRows },
    trendingTracks,
    upcomingMovies,
    { data: statusRows },
    { data: clubRows },
    { data: authorPostRows },
    clubsCount,
    { data: memberRows },
    { data: clubChatRows },
    { data: clubPostRows },
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
      .gte("status_updated_at", new Date(renderNow - 3 * 24 * 60 * 60 * 1000).toISOString())
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
    // Avatars come along so the sidebar can show who's actually in a club.
    // A club with faces on it reads as alive; a club with a number on it
    // reads as a database row.
    // Author review counts, read straight from the table rather than
    // derived from the feed. Ranks and the Most Active list were counted
    // off allPosts, which is both capped at 300 rows AND filtered by the
    // Following toggle - so with Following on, a Legend rendered as
    // "First Review". One uuid column per row keeps this cheap; if the
    // table ever gets big enough for that to matter, this is the place to
    // swap in a grouped aggregate.
    supabase.from("posts").select("user_id"),
    // clubRows is capped at 4 for the sidebar, so the stats line needs a
    // real count or it silently stops rising once there are five clubs.
    supabase
      .from("clubs")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved"),
    supabase.from("club_members").select("club_id, profiles(avatar_url, username)"),
    // Last activity per club. A club's life shows up in two places - its
    // chat room and posts tagged to it - so both get read and the newer
    // of the two wins. Ordered newest-first and capped, so the first hit
    // for a club id is already its latest.
    supabase
      .from("chat_messages")
      .select("club_id, created_at")
      .not("club_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("posts")
      .select("club_id, created_at")
      .not("club_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(120),
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
  const clubFaces = new Map<string, { avatarUrl: string | null; username: string }[]>();
  for (const row of memberRows ?? []) {
    clubMemberCounts.set(row.club_id, (clubMemberCounts.get(row.club_id) ?? 0) + 1);
    // Supabase types an embedded relation as either an object or an array
    // depending on how it infers the join, so both shapes get handled.
    const raw = (row as { profiles?: unknown }).profiles;
    const profile = (Array.isArray(raw) ? raw[0] : raw) as
      | { avatar_url: string | null; username: string }
      | null
      | undefined;
    if (!profile) continue;
    const faces = clubFaces.get(row.club_id) ?? [];
    if (faces.length < 4) {
      faces.push({ avatarUrl: profile.avatar_url, username: profile.username });
      clubFaces.set(row.club_id, faces);
    }
  }

  // Newest-first rows mean the first time a club id appears is its latest
  // activity, so a plain "set if absent" gets the max without sorting.
  const clubLastActive = new Map<string, string>();
  for (const row of [...(clubChatRows ?? []), ...(clubPostRows ?? [])]) {
    const r = row as { club_id: string | null; created_at: string };
    if (!r.club_id) continue;
    const seen = clubLastActive.get(r.club_id);
    if (!seen || r.created_at > seen) clubLastActive.set(r.club_id, r.created_at);
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
  // The category chips filter the list you're reading, not the whole page.
  // allPosts still feeds Top Reviewer, Trending, Now Watching, Feed TV and
  // the rest, so picking "Photography" must not empty the sidebar.
  const feedPosts = typeFilter ? allPosts.filter((p) => p.media_type === typeFilter) : allPosts;

  // Paging happens here rather than in the query on purpose: allPosts feeds
  // Top Reviewer, Trending, Now Watching, Feed TV and the rest, so a
  // LIMIT/OFFSET on the fetch would starve every one of them. The page was
  // rendering all 64 posts at roughly 39,000px tall, which is the real cost
  // being fixed. The 300-row cap on the fetch still applies above this;
  // moving to true database paging means decoupling the widgets first.
  const PAGE_SIZE = 15;
  const totalPages = Math.max(1, Math.ceil(feedPosts.length / PAGE_SIZE));
  const requestedPage = Number.parseInt(page ?? "1", 10);
  const currentPage = Math.min(
    Math.max(Number.isFinite(requestedPage) ? requestedPage : 1, 1),
    totalPages
  );
  const pagePosts = feedPosts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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

  // Every author's true all-time review count, keyed by id so a username
  // change can't orphan it.
  const authorPostCounts = new Map<string, number>();
  for (const row of (authorPostRows ?? []) as { user_id: string }[]) {
    authorPostCounts.set(row.user_id, (authorPostCounts.get(row.user_id) ?? 0) + 1);
  }

  // Built from `posts` rather than `allPosts` on purpose: the leaderboard
  // and Top Reviewer describe the whole community, so they must not shrink
  // when someone switches on the Following filter. The count comes from the
  // table; only the avatar comes from the posts in hand.
  const reviewerCounts = new Map<string, { count: number; avatarUrl: string | null }>();
  for (const post of posts) {
    const name = post.profiles?.username;
    if (!name) continue;
    const existing = reviewerCounts.get(name);
    reviewerCounts.set(name, {
      count: authorPostCounts.get(post.user_id) ?? (existing?.count ?? 0) + 1,
      avatarUrl: existing?.avatarUrl ?? post.profiles?.avatar_url ?? null,
    });
  }
  const topReviewers = [...reviewerCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 7);

  // How many people have reviewed the same thing. Keyed on a normalised
  // title so "The Odyssey" and "the odyssey " count as one. This is what
  // turns an inert "Comment (0)" into "2 others reviewed this" - the
  // conversation already exists, it just was not visible from the feed.
  const titleReviewers = new Map<string, Set<string>>();
  for (const post of posts) {
    const key = post.title.trim().toLowerCase();
    const set = titleReviewers.get(key) ?? new Set<string>();
    set.add(post.user_id);
    titleReviewers.set(key, set);
  }
  const alsoReviewedFor = (post: { title: string; user_id: string }) => {
    const set = titleReviewers.get(post.title.trim().toLowerCase());
    if (!set) return 0;
    // Everyone except the author of this card.
    return set.has(post.user_id) ? set.size - 1 : set.size;
  };

  const topThisWeek = allPosts
    .filter((p) => p.rating && isWithinLastWeek(p.created_at))
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 5);

  const topTracks = allPosts
    .filter((p) => p.media_type === "music" && p.rating)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 5);

  // Trending Music is built ONLY from what members have posted here. It
  // used to be the Last.fm global chart, which meant the most prominent
  // music module on the homepage showed the same records as every other
  // site and none of them had been reviewed by anyone here. A short,
  // sparse list of things real people rated is the point; padding it with
  // a global chart would undo it.
  //
  // Ranked by how many distinct members reviewed a record first, then by
  // average rating, so genuine agreement outranks one person's ten stars.
  type TrendEntry = {
    id: string;
    title: string;
    artist: string | null;
    imageUrl: string | null;
    raters: Set<string>;
    ratingTotal: number;
    ratingCount: number;
  };
  const trendMap = new Map<string, TrendEntry>();
  for (const post of posts) {
    if (post.media_type !== "music") continue;
    const key = `${post.title.trim().toLowerCase()}|${(post.artist ?? "").trim().toLowerCase()}`;
    const entry = trendMap.get(key) ?? {
      id: post.id,
      title: post.title,
      artist: post.artist,
      imageUrl: post.cover_url,
      raters: new Set<string>(),
      ratingTotal: 0,
      ratingCount: 0,
    };
    entry.raters.add(post.user_id);
    entry.imageUrl = entry.imageUrl ?? post.cover_url;
    if (post.rating) {
      entry.ratingTotal += post.rating;
      entry.ratingCount += 1;
    }
    trendMap.set(key, entry);
  }
  const newReleases: ShelfItem[] = [...trendMap.values()]
    .sort((a, b) => {
      if (b.raters.size !== a.raters.size) return b.raters.size - a.raters.size;
      const avgA = a.ratingCount ? a.ratingTotal / a.ratingCount : 0;
      const avgB = b.ratingCount ? b.ratingTotal / b.ratingCount : 0;
      return avgB - avgA;
    })
    .slice(0, 10)
    .map((entry) => ({
      id: entry.id,
      title: entry.title,
      subtitle: entry.artist ?? "",
      imageUrl: entry.imageUrl ?? undefined,
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
  // The ticker scrolls through all of them rather than showing one a day,
  // so the strip has something to say every time you look at it. Rotated
  // by day so the running order isn't always identical.
  const dayIndex = Math.floor(renderNow / (1000 * 60 * 60 * 24)) % FUN_FACTS.length;
  const tickerFacts = [...FUN_FACTS.slice(dayIndex), ...FUN_FACTS.slice(0, dayIndex)];

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

  // Pulled out of the JSX so the shuffle can reorder them as values. Each is
  // null when its flag is off, which orderBlocks drops.
  const leftWideAd = !siteFlags.homepage_ad_wide ? null : wideAd ? (
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
  );


  // "active 3h ago" beats a join date for showing a club is alive. Coarse
  // on purpose: the point is recency, not precision.
  const activeAgo = (iso: string | undefined): string | null => {
    if (!iso) return null;
    const mins = Math.floor((renderNow - new Date(iso).getTime()) / 60000);
    if (mins < 0) return "active now";
    if (mins < 60) return `active ${Math.max(1, mins)}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `active ${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `active ${days}d ago`;
    const weeks = Math.floor(days / 7);
    return weeks < 5 ? `active ${weeks}w ago` : "quiet lately";
  };

  // Sidebar blocks as values so the daily shuffle can reorder them.
  const sideClubs = (
    <>
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
                <span className="club-chip-meta">
                  <span className="club-chip-faces">
                    {(clubFaces.get(club.id) ?? []).map((face) => (
                      <img
                        key={face.username}
                        src={face.avatarUrl || "/avatars/preset-1.svg"}
                        alt=""
                        className="club-face"
                      />
                    ))}
                  </span>
                  <span className="club-chip-count">
                    {clubMemberCounts.get(club.id) ?? 0} member
                    {(clubMemberCounts.get(club.id) ?? 0) === 1 ? "" : "s"}
                  </span>
                </span>
                {activeAgo(clubLastActive.get(club.id)) && (
                  <span className="club-chip-active">{activeAgo(clubLastActive.get(club.id))}</span>
                )}
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
    </>
  );
  const sideSidebarAds = (
    <>
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
    </>
  );
  const sideMostActive = (
    <>
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
    </>
  );
  // "Top Tracks" and "Top This Week" were two panels showing near-identical
  // lists: at this volume almost every rated music post is also from this
  // week, so the sidebar rendered the same five rows twice. One module now,
  // preferring the week (it's the livelier signal) and falling back to
  // all-time music so it never shows an empty state.
  const topRatedRows = topThisWeek.length > 0 ? topThisWeek : topTracks;
  const topRatedTitle = topThisWeek.length > 0 ? "Top This Week" : "Top Rated";
  const sideTopRated =
    topRatedRows.length === 0 ? null : (
      <div className="panel">
        <div className="panel-head tabbed">
          <span className="panel-head-tab">
            <span className="tab-the">the</span>
            <span className="tab-main">{topRatedTitle}</span>
          </span>
        </div>
        <div className="side-list">
          {topRatedRows.map((post, i) => (
            <div className="row" key={post.id}>
              <span className="num">{i + 1}</span>
              <div className="info">
                <b>{post.title}</b>
                <span>
                  {post.profiles?.username ?? "unknown"} · <Stars rating={post.rating} />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  const sideNewsletter = (
    <>
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
    </>
  );
  const sideLiveNow = (
    <>
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
    </>
  );
  const sideStats = (
    <>
  <div className="panel">
    <div className="panel-head tabbed">
      <span className="panel-head-tab">
        <span className="tab-the">the</span>
        <span className="tab-main">Community Stats</span>
      </span>
    </div>
    <div className="stats-body">
      {/* Zero counts are left out. "0 underground creators featured" is the
          same proof-of-emptiness signal as the empty panel that used to sit
          on the homepage, just printed in a different place. */}
      <div>{postsCount.count ?? 0} reviews posted</div>
      {(clubsCount.count ?? 0) > 0 && <div>{clubsCount.count} clubs formed</div>}
      {(artistPostRows ?? []).length > 0 && (
        <div>{(artistPostRows ?? []).length} underground creators featured</div>
      )}
    </div>
  </div>
    </>
  );

  // Hidden entirely when there's nothing in it, rather than rendering "No
  // creator posts yet". An empty module on the homepage is a visible
  // proof-of-emptiness signal, which is the opposite of what a small
  // community needs a visitor to see.
  const leftCreators = !siteFlags.homepage_creators || (artistPostRows ?? []).length === 0 ? null : (
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
        {(artistPostRows ?? []).map((post) => (
          <div className="chat-row" key={post.id}>
            <b>{post.artist_name}</b>{" "}
            <span className={`badge ${post.platform}`}>{ARTIST_PLATFORM_LABELS[post.platform]}</span>
            {post.description && <span> - {post.description}</span>}
            <span className="ts">shared by {post.profiles?.username ?? "unknown"}</span>
          </div>
        ))}
      </div>
    </div>
  );

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

      {feedTvClips.length > 0 && (
        <div className="feedtv-top">
          <FeedTV clips={feedTvClips} />
        </div>
      )}

      <div className="theslap-3col theslap-2col">
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
      </div>

      <div className="fun-fact-banner">
        <span className="fun-fact-label">Did You Know</span>
        {/* Old-web scrolling ticker. The track is duplicated so the loop
            has no visible gap when it wraps; the copy is hidden from
            screen readers so the text isn't announced twice. */}
        <div className="fun-fact-ticker">
          <div className="fun-fact-track">
            {tickerFacts.map((fact) => (
              <span className="fun-fact-item" key={fact}>
                {fact}
              </span>
            ))}
            {tickerFacts.map((fact) => (
              <span className="fun-fact-item" key={`dup-${fact}`} aria-hidden="true">
                {fact}
              </span>
            ))}
          </div>
        </div>
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
          {orderBlocks(
            [
              {
                key: "on-repeat",
                node: spotifyConnected ? (
                  <Shelf
                    title="On Repeat"
                    items={onRepeat}
                    emptyMessage="Play something on Spotify and it'll show up here."
                  />
                ) : null,
              },
              { key: "now-watching", node: <Shelf title="Now Watching" items={nowWatching} /> },
              { key: "wide-ad", node: leftWideAd },
              { key: "creators", node: leftCreators },
            ],
            siteFlags.homepage_shuffle
          ).map((block) => (
            <Fragment key={block.key}>{block.node}</Fragment>
          ))}

          <div className="panel" id="reviews">
            <div className="panel-head tabbed">
              <span className="panel-head-tab">
                <span className="tab-the">the</span>
                <span className="tab-main">Recent Reviews</span>
              </span>
              {user && <FollowingToggle following={followingOnly} />}
            </div>
            {/* Category chips. Links rather than buttons so the filter is a
                real URL people can share and the back button works. The
                following filter is carried through so the two compose. */}
            <div className="feed-chips">
              <Link href={feedHref(null, 1)} className={`feed-chip ${typeFilter ? "" : "active"}`}>
                All
              </Link>
              {MEDIA_TYPES.map((mt) => (
                <Link
                  key={mt}
                  href={feedHref(mt, 1)}
                  className={`feed-chip ${typeFilter === mt ? "active" : ""}`}
                >
                  {MEDIA_FILTER_LABELS[mt]}
                </Link>
              ))}
            </div>
            <div className="panel-body flush">
              {feedPosts.length === 0 ? (
                <div className="empty-state" style={{ padding: 16 }}>
                  {typeFilter
                    ? `No ${MEDIA_FILTER_LABELS[typeFilter].toLowerCase()} reviews yet - be the first to post one.`
                    : followingOnly
                      ? "No reviews yet from people you follow."
                      : "No reviews yet - be the first to post one."}
                </div>
              ) : (
                pagePosts.map((post) => (
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
                      alsoReviewedCount: alsoReviewedFor(post),
                      authorRank: highestBadge(authorPostCounts.get(post.user_id) ?? 0)?.label ?? null,
                    }}
                    currentUserId={user?.id ?? null}
                    viewerIsAdmin={viewerIsAdmin}
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
            {totalPages > 1 && (
              <div className="feed-pager">
                {currentPage > 1 ? (
                  <Link href={feedHref(typeFilter, currentPage - 1)} className="feed-pager-btn">
                    ‹ Newer
                  </Link>
                ) : (
                  <span className="feed-pager-btn disabled">‹ Newer</span>
                )}
                <span className="feed-pager-status">
                  Page {currentPage} of {totalPages}
                  <span className="feed-pager-count">
                    {feedPosts.length} review{feedPosts.length === 1 ? "" : "s"}
                  </span>
                </span>
                {currentPage < totalPages ? (
                  <Link href={feedHref(typeFilter, currentPage + 1)} className="feed-pager-btn">
                    Older ›
                  </Link>
                ) : (
                  <span className="feed-pager-btn disabled">Older ›</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar order is deliberate and NOT shuffled, unlike the left
            column: it runs top-to-bottom by how much a module gives someone
            a reason to come back tomorrow. Orby's daily wishes lead, social
            proof sits in the middle, and pure utility (stats, newsletter)
            drops to the bottom. Shuffling this would throw that away. */}
        <div className="right-col">
          <OrbyBot wishesLeft={orbyWishesLeft} />

          {!user && (
            <div className="panel new-post-card">
              <div className="panel-body">
                <p style={{ margin: "0 0 10px" }}>Have something to review?</p>
                <Link href="/sign-up" className="btn new-post-btn">
                  Create Account
                </Link>
                <div className="auth-switch" style={{ textAlign: "center" }}>
                  <Link href="/sign-in">Sign in</Link>
                </div>
              </div>
            </div>
          )}

          {sideLiveNow}
          {sideMostActive}
          {sideSidebarAds}
          {sideClubs}
          {sideTopRated}
          {sideStats}
          {sideNewsletter}
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
