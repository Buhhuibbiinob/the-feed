import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PostCard } from "@/components/PostCard";
import { ProfileAnthem } from "@/components/ProfileAnthem";
import { FollowButton } from "@/components/FollowButton";
import { AvatarPicker } from "@/components/AvatarPicker";
import { ProfileCustomize } from "@/components/ProfileCustomize";
import { ObsessedPicker } from "@/components/ObsessedPicker";
import { ProfileSongPicker } from "@/components/ProfileSongPicker";
import { FavoritesEditor } from "@/components/FavoritesEditor";
import { StatusPicker } from "@/components/StatusPicker";
import { MEDIA_LABELS, MEDIA_TYPES, type MediaType } from "@/lib/media";
import { buildTasteProfile, tasteMatch as computeMatch, workKey } from "@/lib/taste";
import { earnedBadges, BADGES } from "@/lib/badges";
import { computeStreak } from "@/lib/streak";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { bannerAspectRatio } from "@/lib/bannerShape";
import { renderRichBio } from "@/lib/richBio";
import { fontStack } from "@/lib/profileSkin";
import { loadPageConfig } from "@/lib/pageConfigStore";
import { moduleStyle, visibleModules, type ModuleId } from "@/lib/pageConfig";
import { ProfileArranger } from "@/components/ProfileArranger";
import { ProfileScale } from "@/components/ProfileScale";
import { pageStyle } from "@/lib/pageTheme";
import { PageAppearanceEditor } from "@/components/PageAppearanceEditor";
import { MoodRingEditor } from "@/components/MoodRing";
import { BlurbsEditor } from "@/components/BlurbsEditor";
import { Guestbook, type GuestbookEntry } from "@/components/Guestbook";
import { TopConnections, type Connection } from "@/components/TopConnections";
import { StickerLayer } from "@/components/StickerLayer";
import type { Sticker } from "@/lib/stickers";
import {
  FAVORITE_KINDS,
  FAVORITE_LABELS,
  groupFavorites,
  type Favorite,
  type FavoriteKind,
} from "@/lib/favorites";
import { OBSESSED_LABELS, isObsessedKind } from "@/lib/obsessed";
import { CollectionFollowButton } from "@/components/CollectionFollowButton";
import { Stars } from "@/components/Stars";
import { ProfilePing } from "@/components/ProfilePing";
import { computeWeekInTaste, type WeekPost } from "@/lib/weekInTaste";
import {
  computeLongestStreak,
  earnedAchievements,
  nextAchievement,
  type AchievementContext,
} from "@/lib/achievements";

type ClubMembershipRow = {
  clubs: { id: string; media_type: MediaType; name: string } | null;
};

type ProfileRow = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  banner_url: string | null;
  created_at: string;
  is_verified: boolean;
  bonus_followers: number;
  bonus_likes: number;
  name_color: string | null;
};

type StatusRow = {
  status_media_type: MediaType | null;
  status_title: string | null;
  status_artist: string | null;
  status_cover_url: string | null;
};

// Everything the Phase 1 profile customisation added. Selected separately
// from the core columns for the same reason the status row is: a column
// that hasn't been migrated yet must not take the whole profile down with
// it, it should just leave that one feature switched off.
type CustomizationRow = {
  banner_aspect: string | null;
  bio_font: string | null;
  bio_color: string | null;
  profile_bg_color: string | null;
  profile_panel_color: string | null;
  profile_text_color: string | null;
  profile_accent_color: string | null;
  profile_layout: string[] | null;
  obsessed_kind: string | null;
  obsessed_title: string | null;
  obsessed_note: string | null;
  obsessed_image_url: string | null;
  profile_song_youtube_id: string | null;
  profile_song_spotify_id: string | null;
  profile_song_title: string | null;
  profile_song_artist: string | null;
  profile_song_thumbnail_url: string | null;
  profile_song_autoplay: boolean | null;
  mood_emoji: string | null;
  mood_color: string | null;
  mood_text: string | null;
  blurb_next: string | null;
  blurb_free: string | null;
  last_seen_at: string | null;
};

const CUSTOMIZATION_COLUMNS =
  "banner_aspect, bio_font, bio_color, profile_bg_color, profile_panel_color, profile_text_color, " +
  "profile_accent_color, profile_layout, obsessed_kind, obsessed_title, obsessed_note, " +
  "obsessed_image_url, profile_song_youtube_id, profile_song_spotify_id, profile_song_title, " +
  "profile_song_artist, profile_song_thumbnail_url, profile_song_autoplay, mood_emoji, " +
  "mood_color, mood_text, blurb_next, blurb_free, last_seen_at";


type CollectionRow = { id: string; name: string; description: string | null };

type ProfileRef = { username: string; avatar_url: string | null };
type GuestbookRow = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  profiles: ProfileRef | ProfileRef[] | null;
};
type ConnectionRow = {
  friend_id: string;
  position: number;
  profiles: ProfileRef | ProfileRef[] | null;
};
type PinnedRow = { post_id: string; position: number };
type StickerRow = {
  id: string;
  image_url: string;
  x: number;
  y: number;
  scale: number;
  scale_y: number | null;
  rotation: number;
  skew: number | null;
  z: number;
};
type CollectionFollowRow = { collection_id: string; user_id: string };

type FavoriteRow = {
  id: string;
  kind: FavoriteKind;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  position: number;
};

// Cap on the site-wide review scan behind taste match and discoveries.
// Ordered oldest-first so "who reviewed this first" stays correct for
// everything inside the window.
const TASTE_SCAN_LIMIT = 5000;

type ScanRow = {
  user_id: string;
  title: string;
  artist: string | null;
  rating: number | null;
  created_at: string;
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
  club_id: string | null;
};

/** How long ago, in the coarse terms a "last online" line actually wants. */
function lastOnlineLabel(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 5) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d ago` : "a while ago";
}

function Panel({
  id,
  title,
  style,
  children,
}: {
  id?: string;
  title: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div className="panel" id={id} style={style}>
      <div className="panel-head">{title}</div>
      <div className="panel-body">{children}</div>
    </div>
  );
}

function EmptySlot({ children }: { children: React.ReactNode }) {
  return (
    <div className="empty-state" style={{ padding: 16 }}>
      {children}
    </div>
  );
}

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
    .select("id, username, avatar_url, bio, banner_url, created_at, is_verified, bonus_followers, bonus_likes, name_color")
    .eq("username", username)
    .maybeSingle();

  const profileRow = profileData as ProfileRow | null;
  if (!profileRow) notFound();
  // Aliased once the null check has run so the section renderers below,
  // which TypeScript can't see the narrowing through, don't each need an
  // assertion.
  const profile: ProfileRow = profileRow;

  // Fetched separately so a not-yet-migrated `status_*` column can't 404 the whole profile.
  const { data: statusData } = await supabase
    .from("profiles")
    .select("status_media_type, status_title, status_artist, status_cover_url")
    .eq("id", profile.id)
    .maybeSingle();
  const status = statusData as StatusRow | null;

  const { data: customData } = await supabase
    .from("profiles")
    .select(CUSTOMIZATION_COLUMNS)
    .eq("id", profile.id)
    .maybeSingle();
  const custom = (customData ?? null) as CustomizationRow | null;

  const [
    { data: postRows },
    { count: followerCount },
    { count: followingCount },
    { data: likeRows },
    { data: commentRows },
    { data: clubMembershipRows },
    { data: favoriteRows },
  ] = await Promise.all([
    supabase
      .from("posts")
      .select(
        "id, user_id, media_type, title, body, rating, created_at, artist, cover_url, spotify_track_id, youtube_video_id, club_id"
      )
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
    supabase
      .from("club_members")
      .select("clubs(id, media_type, name)")
      .eq("user_id", profile.id)
      .returns<ClubMembershipRow[]>(),
    supabase
      .from("profile_favorites")
      .select("id, kind, title, subtitle, image_url, position")
      .eq("user_id", profile.id)
      .order("position", { ascending: true })
      .returns<FavoriteRow[]>(),
  ]);

  const posts = postRows ?? [];
  const clubs = (clubMembershipRows ?? [])
    .map((row) => row.clubs)
    .filter((club): club is NonNullable<ClubMembershipRow["clubs"]> => club !== null);

  const favorites = groupFavorites(
    (favoriteRows ?? []).map<Favorite>((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      subtitle: row.subtitle,
      imageUrl: row.image_url,
      position: row.position,
    }))
  );
  const favoriteCount = FAVORITE_KINDS.reduce((sum, kind) => sum + favorites[kind].length, 0);

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


  // Built from MEDIA_TYPES rather than a literal, so adding a category
  // can't silently leave a counter missing here again.
  const breakdown = Object.fromEntries(MEDIA_TYPES.map((mt) => [mt, 0])) as Record<MediaType, number>;
  for (const post of posts) breakdown[post.media_type]++;

  const realLikesReceived = posts.reduce((sum, post) => sum + (likeCounts.get(post.id) ?? 0), 0);
  const totalLikesReceived = realLikesReceived + (profile.bonus_likes ?? 0);
  const totalFollowerCount = (followerCount ?? 0) + (profile.bonus_followers ?? 0);

  const isOwnProfile = user?.id === profile.id;
  const badges = earnedBadges(posts.length);
  const nextBadge = BADGES.find((b) => b.threshold > posts.length) ?? null;
  const streak = computeStreak(posts.map((p) => p.created_at));

  // One scan of the site's reviews, reused three times over: the visitor's
  // taste match, who was first to review a given work, and nothing else has
  // to read the posts table again.
  const { data: scanRows } = await supabase
    .from("posts")
    .select("user_id, title, artist, rating, created_at")
    .order("created_at", { ascending: true })
    .limit(TASTE_SCAN_LIMIT)
    .returns<ScanRow[]>();
  const scan = scanRows ?? [];

  // First review of a work wins the discovery. The scan is ordered oldest
  // first, so the first time a key appears is the one that counts.
  const firstReviewer = new Map<string, string>();
  for (const row of scan) {
    if (!row.title) continue;
    const key = workKey(row.title, row.artist);
    if (!firstReviewer.has(key)) firstReviewer.set(key, row.user_id);
  }
  let discoveries = 0;
  for (const [, ownerId] of firstReviewer) if (ownerId === profile.id) discoveries++;

  let isFollowing = false;
  let tasteMatch: number | null = null;
  if (user && !isOwnProfile) {
    const [{ data: followRow }, { data: myClubRows }] = await Promise.all([
      supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", user.id)
        .eq("followed_id", profile.id)
        .maybeSingle(),
      supabase.from("club_members").select("club_id").eq("user_id", user.id),
    ]);
    isFollowing = !!followRow;

    const myScanPosts = scan.filter((row) => row.user_id === user.id);
    const mine = buildTasteProfile({
      posts: myScanPosts,
      clubIds: (myClubRows ?? []).map((r) => r.club_id as string),
    });
    const theirs = buildTasteProfile({
      posts: posts.map((p) => ({ title: p.title, artist: p.artist, rating: p.rating })),
      clubIds: clubs.map((c) => c.id),
    });
    tasteMatch = computeMatch(mine, theirs);
  }

  const [{ data: twinRow }, { count: viewerCount }, { count: commentsWritten }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("taste_twin_id, taste_twin_score, taste_twin_at")
        .eq("id", profile.id)
        .maybeSingle(),
      // Only the owner is allowed to read their own view rows, so for a
      // visitor this comes back null rather than leaking the number.
      supabase
        .from("profile_views")
        .select("viewer_id", { count: "exact", head: true })
        .eq("profile_id", profile.id),
      supabase
        .from("comments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id),
    ]);

  // The twin is only ever shown to the profile's owner. It's built from who
  // they overlap with, which is theirs to know and nobody else's business.
  let twin: { username: string; avatarUrl: string | null; score: number | null } | null = null;
  const twinId = (twinRow?.taste_twin_id as string | null | undefined) ?? null;
  if (isOwnProfile && twinId) {
    const { data: twinProfile } = await supabase
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", twinId)
      .maybeSingle();
    if (twinProfile) {
      twin = {
        username: twinProfile.username as string,
        avatarUrl: (twinProfile.avatar_url as string | null) ?? null,
        score: (twinRow?.taste_twin_score as number | null | undefined) ?? null,
      };
    }
  }

  const [{ data: collectionRows }, { data: collectionFollowRows }] = await Promise.all([
    supabase
      .from("collections")
      .select("id, name, description")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .returns<CollectionRow[]>(),
    supabase.from("collection_follows").select("collection_id, user_id").returns<CollectionFollowRow[]>(),
  ]);

  const collections = collectionRows ?? [];
  const followsByCollection = new Map<string, CollectionFollowRow[]>();
  for (const row of collectionFollowRows ?? []) {
    const list = followsByCollection.get(row.collection_id) ?? [];
    list.push(row);
    followsByCollection.set(row.collection_id, list);
  }

  // Reviews surface themselves: the highest rated and the most discussed,
  // picked automatically so the section fills in without the member
  // choosing anything.
  const ratedPosts = posts.filter((p) => p.rating != null);
  const topRated = ratedPosts.length
    ? ratedPosts.reduce((best, p) => ((p.rating ?? 0) > (best.rating ?? 0) ? p : best))
    : null;
  const mostDiscussed = posts.length
    ? posts.reduce((best, p) =>
        (commentCounts.get(p.id) ?? 0) > (commentCounts.get(best.id) ?? 0) ? p : best
      )
    : null;
  // Only worth a panel if anyone actually replied - "most discussed, 0
  // comments" is a worse thing to print than nothing.
  const highlights = [
    topRated ? { label: "Highest rated", post: topRated } : null,
    mostDiscussed && (commentCounts.get(mostDiscussed.id) ?? 0) > 0 && mostDiscussed.id !== topRated?.id
      ? { label: "Most discussed", post: mostDiscussed }
      : null,
  ].filter((h): h is { label: string; post: PostRow } => h !== null);

  const [{ data: guestbookRows }, { data: connectionRows }, { data: pinnedRows }, { data: stickerRows }] =
    await Promise.all([
    supabase
      .from("guestbook_entries")
      .select("id, body, created_at, author_id, profiles!guestbook_entries_author_id_fkey(username, avatar_url)")
      .eq("profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(30)
      .returns<GuestbookRow[]>(),
    supabase
      .from("top_connections")
      .select("friend_id, position, profiles!top_connections_friend_id_fkey(username, avatar_url)")
      .eq("user_id", profile.id)
      .order("position", { ascending: true })
      .returns<ConnectionRow[]>(),
    supabase
      .from("pinned_posts")
      .select("post_id, position")
      .eq("user_id", profile.id)
      .order("position", { ascending: true })
      .returns<PinnedRow[]>(),
    supabase
      .from("profile_stickers")
      .select("id, image_url, x, y, scale, scale_y, rotation, skew, z")
      .eq("user_id", profile.id)
      .order("z", { ascending: true })
      .returns<StickerRow[]>(),
  ]);

  const guestbook: GuestbookEntry[] = (guestbookRows ?? []).map((row) => {
    const author = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      body: row.body,
      createdAt: row.created_at,
      authorId: row.author_id,
      authorUsername: author?.username ?? "someone",
      authorAvatarUrl: author?.avatar_url ?? null,
    };
  });

  const connections: Connection[] = (connectionRows ?? []).flatMap((row) => {
    const friend = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return friend ? [{ id: row.friend_id, username: friend.username, avatarUrl: friend.avatar_url }] : [];
  });

  const stickers: Sticker[] = (stickerRows ?? []).map((row) => ({
    id: row.id,
    imageUrl: row.image_url,
    x: row.x,
    y: row.y,
    scale: row.scale,
    // Null for stickers placed before these columns existed.
    scaleY: row.scale_y ?? 1,
    rotation: row.rotation,
    skew: row.skew ?? 0,
    z: row.z,
  }));

  const pinnedPosts = (pinnedRows ?? [])
    .map((row) => posts.find((p) => p.id === row.post_id))
    .filter((p): p is PostRow => p !== undefined);

  const week = computeWeekInTaste(
    posts.map<WeekPost>((p) => ({
      id: p.id,
      title: p.title,
      artist: p.artist,
      mediaType: p.media_type,
      rating: p.rating,
      coverUrl: p.cover_url,
      createdAt: p.created_at,
    }))
  );

  const achievementContext: AchievementContext = {
    reviewCount: posts.length,
    streak,
    longestStreak: computeLongestStreak(posts.map((p) => p.created_at)),
    categoriesCovered: MEDIA_TYPES.filter((mt) => breakdown[mt] > 0).length,
    likesReceived: totalLikesReceived,
    commentsWritten: commentsWritten ?? 0,
    discoveries,
    clubsJoined: clubs.length,
  };
  const achievements = earnedAchievements(achievementContext);
  const nextUp = nextAchievement(achievementContext);


  const bioStyle = {
    fontFamily: fontStack(custom?.bio_font) ?? undefined,
    color: custom?.bio_color ?? undefined,
  };

  const moodEmoji = custom?.mood_emoji ?? null;
  const obsessedKind = isObsessedKind(custom?.obsessed_kind) ? custom.obsessed_kind : null;
  const obsessedTitle = custom?.obsessed_title ?? null;
  const songId = custom?.profile_song_youtube_id ?? null;
  const songSpotifyId = custom?.profile_song_spotify_id ?? null;
  const hasSong = !!(songId || songSpotifyId);

  // One config drives the look and the module order, and the same loader
  // serves club pages. A profile customised before page_configs existed is
  // synthesised from the old columns rather than coming back blank.
  const config = await loadPageConfig(supabase, "profile", profile.id);
  const moduleStates = new Map(config.modules.map((m) => [m.id, m]));

  // A section with nothing in it is hidden from visitors and shown to the
  // owner as a prompt - an empty panel on someone else's profile just reads
  // as "nobody uses this".
  const sectionHasContent: Record<string, boolean> = {
    obsessed: !!obsessedTitle,
    song: hasSong,
    week: week !== null,
    // The twin callout is the owner's alone, so for anyone else this
    // section has nothing in it by definition.
    twin: isOwnProfile && twin !== null,
    mood: !!moodEmoji || !!custom?.mood_text,
    about: !!profile.bio,
    blurbs: !!custom?.blurb_next || !!custom?.blurb_free,
    connections: connections.length > 0,
    pinned: pinnedPosts.length > 0,
    guestbook: guestbook.length > 0,
    presence: (viewerCount ?? 0) > 0 || !!custom?.last_seen_at,
    highlights: highlights.length > 0,
    collections: collections.length > 0,
    favorites: favoriteCount > 0,
    achievements: achievements.length > 0,
    stats: MEDIA_TYPES.some((mt) => breakdown[mt] > 0),
    clubs: clubs.length > 0,
    reviews: posts.length > 0,
  };

  function renderSection(id: ModuleId) {
    switch (id) {
      case "obsessed":
        return (
          <div className="panel" key={id} id={id} style={moduleStyle(moduleStates.get(id))}>
            <div className="panel-head">Obsessed With</div>
            <div className="panel-body">
              {obsessedTitle ? (
                <div className="obsessed">
                  {custom?.obsessed_image_url && (
                    <img className="obsessed-art" src={custom.obsessed_image_url} alt="" />
                  )}
                  <div>
                    {obsessedKind && <div className="obsessed-kind">{OBSESSED_LABELS[obsessedKind]}</div>}
                    <div className="obsessed-title">{obsessedTitle}</div>
                    {custom?.obsessed_note && <div className="obsessed-note">{custom.obsessed_note}</div>}
                  </div>
                </div>
              ) : (
                <EmptySlot>{isOwnProfile ? "Pin whatever you can't shut up about." : "Nothing pinned."}</EmptySlot>
              )}
            </div>
          </div>
        );

      case "anthem":
        return (
          <div className="panel" key={id} id={id} style={moduleStyle(moduleStates.get(id))}>
            <div className="panel-head">My Anthem</div>
            <div className="panel-body">
              {hasSong ? (
                <ProfileAnthem
                  youtubeVideoId={songId}
                  spotifyTrackId={songSpotifyId}
                  title={custom?.profile_song_title ?? "Profile song"}
                  artist={custom?.profile_song_artist ?? null}
                  thumbnailUrl={custom?.profile_song_thumbnail_url ?? null}
                  autoplay={custom?.profile_song_autoplay === true}
                />
              ) : (
                <EmptySlot>{isOwnProfile ? "No song yet. Pick one." : "Silence."}</EmptySlot>
              )}
            </div>
          </div>
        );

      case "week":
        return (
          <div className="panel" key={id} id={id} style={moduleStyle(moduleStates.get(id))}>
            <div className="panel-head">
              This Week
            </div>
            <div className="panel-body">
              {!week ? (
                <EmptySlot>Quiet week.</EmptySlot>
              ) : (
                <div className="week-taste">
                  <div className="week-figures">
                    <span>
                      <b>{week.reviewCount}</b> review{week.reviewCount === 1 ? "" : "s"}
                    </span>
                    <span>
                      <b>{week.daysActive}</b> day{week.daysActive === 1 ? "" : "s"} active
                    </span>
                    {week.averageRating !== null && (
                      <span>
                        <b>{week.averageRating.toFixed(1)}</b> avg rating
                      </span>
                    )}
                  </div>
                  {week.standout && (
                    <Link href={`/post/${week.standout.id}`} className="week-standout">
                      {week.standout.coverUrl ? (
                        <img src={week.standout.coverUrl} alt="" />
                      ) : (
                        <span className="favorite-blank" />
                      )}
                      <span>
                        <span className="week-standout-label">Highest rated this week</span>
                        <b>{week.standout.title}</b>
                        {week.standout.artist && <span className="sub">{week.standout.artist}</span>}
                      </span>
                    </Link>
                  )}
                  <div className="week-categories">
                    {week.categories.map((c) => (
                      <span className={`badge ${c.mediaType}`} key={c.mediaType}>
                        {c.label} x{c.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case "twin":
        // Rendered for the owner only - the filter below keeps it off other
        // people's view of the page, and this guard keeps it that way even
        // if someone re-orders the sections.
        if (!isOwnProfile) return null;
        return (
          <div className="panel" key={id} id={id} style={moduleStyle(moduleStates.get(id))}>
            <div className="panel-head">Taste Twin</div>
            <div className="panel-body">
              {!twin ? (
                <EmptySlot>Not enough overlap yet to name one.</EmptySlot>
              ) : (
                <Link href={`/profile/${twin.username}`} className="taste-twin">
                  <img src={twin.avatarUrl || "/avatars/preset-1.svg"} alt="" />
                  <span>
                    <b>{twin.username}</b>
                    {twin.score !== null && (
                      <span className="taste-twin-score">{twin.score}% match</span>
                    )}
                    <span className="sub">Closest taste to yours right now</span>
                  </span>
                </Link>
              )}
            </div>
          </div>
        );

      case "achievements":
        return (
          <div className="panel" key={id} id={id} style={moduleStyle(moduleStates.get(id))}>
            <div className="panel-head">Trophies</div>
            <div className="panel-body">
              {achievements.length === 0 ? (
                <EmptySlot>None yet.</EmptySlot>
              ) : (
                <div className="achievement-grid">
                  {achievements.map((a) => (
                    <span className="achievement" key={a.id} title={a.description}>
                      {a.label}
                    </span>
                  ))}
                </div>
              )}
              {isOwnProfile && nextUp && (
                <div className="profile-badge-next">
                  Next up: <b>{nextUp.label}</b> - {nextUp.description} (
                  {nextUp.progress(achievementContext).current}/
                  {nextUp.progress(achievementContext).target})
                </div>
              )}
            </div>
          </div>
        );

      case "mood":
        return (
          <Panel key={id} id={id} style={moduleStyle(moduleStates.get(id))} title="Mood">
            {!moodEmoji && !custom?.mood_text ? (
              <EmptySlot>{isOwnProfile ? "How are you, then?" : "No mood set."}</EmptySlot>
            ) : (
              <div className="mood-ring-row">
                <span
                  className="mood-ring"
                  style={{ borderColor: custom?.mood_color ?? "var(--link)" }}
                >
                  {moodEmoji ?? "•"}
                </span>
                {custom?.mood_text && <span className="mood-text">{custom.mood_text}</span>}
              </div>
            )}
          </Panel>
        );

      case "about":
        return (
          <Panel key={id} id={id} style={moduleStyle(moduleStates.get(id))} title="About Me">
            {profile.bio ? (
              <div className="profile-bio" style={bioStyle}>
                {renderRichBio(profile.bio)}
              </div>
            ) : (
              <EmptySlot>{isOwnProfile ? "Say something about yourself." : "Nothing written."}</EmptySlot>
            )}
          </Panel>
        );

      case "blurbs":
        return (
          <Panel key={id} id={id} style={moduleStyle(moduleStates.get(id))} title="Blurbs">
            {!custom?.blurb_next && !custom?.blurb_free ? (
              <EmptySlot>{isOwnProfile ? "What are you putting off reviewing?" : "Empty."}</EmptySlot>
            ) : (
              <div className="blurb-list">
                {custom?.blurb_next && (
                  <div className="blurb">
                    <span className="week-standout-label">What I&apos;d like to review next</span>
                    <div>{custom.blurb_next}</div>
                  </div>
                )}
                {custom?.blurb_free && <div className="blurb">{custom.blurb_free}</div>}
              </div>
            )}
          </Panel>
        );

      case "connections":
        return (
          <Panel key={id} id={id} style={moduleStyle(moduleStates.get(id))} title="Top 8">
            <TopConnections connections={connections} isOwner={isOwnProfile} />
          </Panel>
        );

      case "pinned":
        return (
          <Panel key={id} id={id} style={moduleStyle(moduleStates.get(id))} title="Pinned">
            {pinnedPosts.length === 0 ? (
              <EmptySlot>{isOwnProfile ? "Pin a review from its page." : "Nothing pinned."}</EmptySlot>
            ) : (
              <div className="panel-body flush">
                {pinnedPosts.map((post) => (
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
                      username: profile.username,
                    }}
                    currentUserId={user?.id ?? null}
                    liked={likedByMe.has(post.id)}
                    likeCount={likeCounts.get(post.id) ?? 0}
                    commentCount={commentCounts.get(post.id) ?? 0}
                  />
                ))}
              </div>
            )}
          </Panel>
        );

      case "guestbook":
        return (
          <Panel key={id} id={id} style={moduleStyle(moduleStates.get(id))} title="Guestbook">
            <Guestbook
              profileId={profile.id}
              entries={guestbook}
              currentUserId={user?.id ?? null}
              isOwner={isOwnProfile}
            />
          </Panel>
        );

      case "presence":
        return (
          <Panel key={id} id={id} style={moduleStyle(moduleStates.get(id))} title="Online">
            <div className="week-figures">
              {isOwnProfile && viewerCount != null && (
                <span>
                  <b>{viewerCount}</b> profile views
                </span>
              )}
              {custom?.last_seen_at && (
                <span>
                  <b>{lastOnlineLabel(custom.last_seen_at)}</b> last online
                </span>
              )}
              <span>
                <b>{new Date(profile.created_at).toLocaleDateString()}</b> joined
              </span>
            </div>
          </Panel>
        );

      case "highlights":
        return (
          <div className="panel" key={id} id={id} style={moduleStyle(moduleStates.get(id))}>
            <div className="panel-head">Greatest Hits</div>
            <div className="panel-body">
              {highlights.length === 0 ? (
                <EmptySlot>{isOwnProfile ? "Rate something and your best turns up here." : "Nothing yet."}</EmptySlot>
              ) : (
                <div className="highlight-list">
                  {highlights.map((h) => (
                    <Link href={`/post/${h.post.id}`} className="highlight-row" key={h.label}>
                      {h.post.cover_url ? (
                        <img src={h.post.cover_url} alt="" />
                      ) : (
                        <span className="favorite-blank" />
                      )}
                      <span>
                        <span className="week-standout-label">{h.label}</span>
                        <b>{h.post.title}</b>
                        {h.post.artist && <span className="sub">{h.post.artist}</span>}
                      </span>
                      {h.post.rating && (
                        <span className="highlight-stars">
                          <Stars rating={h.post.rating} />
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case "collections":
        return (
          <div className="panel" key={id} id={id} style={moduleStyle(moduleStates.get(id))}>
            <div className="panel-head">
              Collections
              <Link href="/collections" className="see-all">
                See All ▸
              </Link>
            </div>
            <div className="panel-body">
              {collections.length === 0 ? (
                <EmptySlot>
                  {isOwnProfile
                    ? "Songs for driving at 2am. That sort of thing."
                    : "No collections."}
                </EmptySlot>
              ) : (
                <div className="collection-list">
                  {collections.map((collection) => {
                    const follows = followsByCollection.get(collection.id) ?? [];
                    return (
                      <div className="collection-row" key={collection.id}>
                        <Link href={`/collections/${collection.id}`} className="collection-row-main">
                          <b>{collection.name}</b>
                          {collection.description && (
                            <span className="sub">{collection.description}</span>
                          )}
                        </Link>
                        {user && !isOwnProfile ? (
                          <CollectionFollowButton
                            collectionId={collection.id}
                            following={follows.some((f) => f.user_id === user.id)}
                            count={follows.length}
                          />
                        ) : (
                          follows.length > 0 && (
                            <span className="collection-followers">
                              {follows.length} follower{follows.length === 1 ? "" : "s"}
                            </span>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );

      case "favorites":
        return (
          <div className="panel" key={id} id={id} style={moduleStyle(moduleStates.get(id))}>
            <div className="panel-head">Favorites</div>
            <div className="panel-body">
              {favoriteCount === 0 ? (
                <EmptySlot>{isOwnProfile ? "Pick your eight." : "Empty."}</EmptySlot>
              ) : (
                <div className="favorites-grid">
                  {FAVORITE_KINDS.filter((kind) => favorites[kind].length > 0).map((kind) => (
                    <div className="favorites-column" key={kind}>
                      <div className="favorites-column-head">{FAVORITE_LABELS[kind]}</div>
                      <ol className="favorites-list">
                        {favorites[kind].map((item) => (
                          <li key={item.id}>
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt="" />
                            ) : (
                              <span className="favorite-blank" />
                            )}
                            <span className="favorite-body">
                              <b>{item.title}</b>
                              {item.subtitle && <span className="sub">{item.subtitle}</span>}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case "stats":
        return (
          <div className="panel" key={id} id={id} style={moduleStyle(moduleStates.get(id))}>
            <div className="panel-head">Details</div>
            <div className="panel-body flush">
              {/* Three figures across the top, the way a profile states
                  itself in every one of the references - big number over a
                  small grey label, one object rather than three boxes. */}
              <div className="stat-strip">
                <span className="stat-cell">
                  <span className="stat-num">{posts.length}</span>
                  <span className="stat-label">Reviews</span>
                </span>
                <span className="stat-cell">
                  <span className="stat-num">{totalFollowerCount}</span>
                  <span className="stat-label">Followers</span>
                </span>
                <span className="stat-cell">
                  <span className="stat-num">{totalLikesReceived}</span>
                  <span className="stat-label">Ratings</span>
                </span>
              </div>
              {/* Only categories they've actually posted in. Otherwise every
                  profile would carry a permanent "0 Photography reviews" line
                  the day the category shipped.

                  Label on the left, count on the right: "Music / 12" is a
                  table you scan, where "12 Music reviews" is a sentence you
                  have to read. */}
              {MEDIA_TYPES.filter((mt) => breakdown[mt] > 0).map((mt) => (
                <div className="kv-row" key={mt}>
                  <span className="kv-key">{MEDIA_LABELS[mt]}</span>
                  <span className="kv-val">{breakdown[mt]}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case "clubs":
        return (
          <div className="panel" key={id} id={id} style={moduleStyle(moduleStates.get(id))}>
            <div className="panel-head">Clubs</div>
            <div className="panel-body flush">
              {clubs.map((club) => (
                <Link href={`/clubs/${club.id}`} className="club-row" key={club.id}>
                  <span className={`badge ${club.media_type}`}>{MEDIA_LABELS[club.media_type]}</span>
                  <span className="club-row-name">{club.name}</span>
                </Link>
              ))}
            </div>
          </div>
        );

      case "reviews":
        return (
          <div className="panel" key={id} id={id} style={moduleStyle(moduleStates.get(id))}>
            <div className="panel-head">Reviews</div>
            <div className="panel-body flush">
              {posts.length === 0 ? (
                <EmptySlot>No reviews yet.</EmptySlot>
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
        );
    }
  }

  // Resolved once and split across the two columns below. Empty modules
  // stay hidden from visitors and show the owner a prompt, as before.
  const shownModules = visibleModules(config).filter(
    (id) => isOwnProfile || sectionHasContent[id]
  );

  return (
    <ProfileScale>
      <div className="profile-skin" style={pageStyle(config.palette, config.fontPairId, config.background)}>
      {user && <ProfilePing profileId={profile.id} isOwnProfile={isOwnProfile} />}
      <StickerLayer stickers={stickers} isOwner={isOwnProfile} />

      {/* The columns belong to the arranger now: it places each panel and
          lets the owner drag them between the two. The panels themselves
          are still rendered here on the server - the arranger only decides
          where they go. */}
      <ProfileArranger
        ownerId={profile.id}
        config={config}
        order={shownModules}
        isOwner={isOwnProfile}
        panels={Object.fromEntries(shownModules.map((id) => [id, renderSection(id)]))}
        sideHeader={
          <>
          {/* The identity card: big square photo, actions stacked beside
              it, everything else underneath. This is the block the whole
              page is built around, so it leads the column. */}
          <div className="pf-card">
            <div className="pf-card-head">
              {isOwnProfile ? "Hello, " : ""}
              <b style={profile.name_color ? { color: profile.name_color } : undefined}>
                {profile.username}
              </b>
              <span>{isOwnProfile ? "!" : ""}</span>
              {profile.is_verified && <VerifiedBadge />}
            </div>
            <div className="pf-card-body">
              {/* The photo runs the full width of the column. It's the
                  thing people came to look at, so it gets the room. */}
              <img
                src={profile.avatar_url || "/avatars/preset-1.svg"}
                alt={profile.username}
                className="pf-photo"
              />

              <div className="pf-id">
                <div className="pf-links">
                  {isOwnProfile ? (
                    <>
                      <Link href="/post/new">Post a Review</Link>
                      <Link href="/settings">Account Settings</Link>
                      <Link href="/collections">Manage Collections</Link>
                      <Link href="/messages">Read Messages</Link>
                      <Link href="/alerts">See Alerts</Link>
                    </>
                  ) : user ? (
                    <>
                      <FollowButton
                        followedId={profile.id}
                        username={profile.username}
                        following={isFollowing}
                      />
                      <Link href={`/messages/${profile.username}`}>Send Message</Link>
                      <Link href={`/profile/${profile.username}#guestbook`}>Sign Guestbook</Link>
                    </>
                  ) : (
                    <Link href="/sign-in">Sign in to follow</Link>
                  )}
                </div>
              </div>

              {status?.status_media_type && (
                <div className="pf-status">
                  {status.status_media_type === "music" ? "Listening to " : "Watching "}
                  <b>{status.status_title}</b>
                  {status.status_artist && <> - {status.status_artist}</>}
                </div>
              )}

              {profile.bio && (
                <div className="pf-blurb" style={bioStyle}>
                  {renderRichBio(profile.bio)}
                </div>
              )}

              <div className="pf-viewmy">
                <b>View:</b> <Link href={`/profile/${profile.username}#reviews`}>Reviews</Link>
                {" | "}
                <Link href={`/profile/${profile.username}#guestbook`}>Guestbook</Link>
                {clubs.length > 0 && (
                  <>
                    {" | "}
                    <Link href="/clubs">Clubs</Link>
                  </>
                )}
                {collections.length > 0 && (
                  <>
                    {" | "}
                    <Link href="/collections">Collections</Link>
                  </>
                )}
              </div>
              <div className="pf-url">
                <b>URL:</b> /profile/{profile.username}
              </div>
            </div>
          </div>

          {/* The numbers, in their own box the way the reference keeps
              them - not crammed under the name. */}
          <div className="pf-card">
            <div className="pf-card-head alt">
              {isOwnProfile ? "Your Stats" : `${profile.username}'s Stats`}
            </div>
            <div className="pf-card-body">
              <table className="pf-stats">
                <tbody>
                  <tr>
                    <td>Reviews</td>
                    <td>{posts.length}</td>
                  </tr>
                  <tr>
                    <td>Followers</td>
                    <td>{totalFollowerCount}</td>
                  </tr>
                  <tr>
                    <td>Following</td>
                    <td>{followingCount ?? 0}</td>
                  </tr>
                  <tr>
                    <td>Likes</td>
                    <td>{totalLikesReceived}</td>
                  </tr>
                  {tasteMatch !== null && (
                    <tr>
                      <td>Taste match</td>
                      <td className="taste-match">{tasteMatch}%</td>
                    </tr>
                  )}
                  {streak > 1 && (
                    <tr>
                      <td>Streak</td>
                      <td className="streak-count">{streak} days</td>
                    </tr>
                  )}
                  {isOwnProfile && viewerCount != null && viewerCount > 0 && (
                    <tr>
                      <td>Profile views</td>
                      <td>{viewerCount}</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {badges.length > 0 && (
                <div className="profile-badges">
                  {badges.map((b) => (
                    <span
                      key={b.id}
                      className="profile-badge"
                      title={`${b.label} - ${b.threshold}+ reviews`}
                    >
                      {b.label}
                    </span>
                  ))}
                </div>
              )}
              {nextBadge && isOwnProfile && (
                <div className="profile-badge-next">
                  {nextBadge.threshold - posts.length} more review
                  {nextBadge.threshold - posts.length === 1 ? "" : "s"} to unlock {nextBadge.label}
                </div>
              )}
            </div>
          </div>

          {/* The owner's controls, in the side column under the card -
              the same place the reference keeps "Edit Profile". */}
          {isOwnProfile && (
            <div className="pf-card">
              <div className="pf-card-head alt">Customize</div>
              <div className="pf-card-body">
                <div className="profile-editor-actions">
              <AvatarPicker />
              <ProfileCustomize
                bio={profile.bio}
                bioFont={custom?.bio_font ?? null}
                bioColor={custom?.bio_color ?? null}
                bannerAspectId={custom?.banner_aspect ?? null}
              />
              <StatusPicker hasStatus={!!status?.status_media_type} />
              <ObsessedPicker
                current={{
                  kind: obsessedKind,
                  title: obsessedTitle,
                  note: custom?.obsessed_note ?? null,
                  imageUrl: custom?.obsessed_image_url ?? null,
                }}
              />
              <ProfileSongPicker
                current={{
                  youtubeId: songId,
                  title: custom?.profile_song_title ?? null,
                  artist: custom?.profile_song_artist ?? null,
                  thumbnailUrl: custom?.profile_song_thumbnail_url ?? null,
                  autoplay: custom?.profile_song_autoplay === true,
                }}
              />
              <FavoritesEditor favorites={favorites} />
              <MoodRingEditor
                emoji={moodEmoji}
                color={custom?.mood_color ?? null}
                text={custom?.mood_text ?? null}
              />
              <BlurbsEditor next={custom?.blurb_next ?? null} free={custom?.blurb_free ?? null} />
              {/* Colours, fonts, background and module order all live in one
                  editor now, and the same one runs on club pages. */}
                  <PageAppearanceEditor surface="profile" ownerId={profile.id} config={config} />
                </div>
              </div>
            </div>
          )}

          </>
        }
        mainHeader={
          <>
          {/* The banner heads the main column - the wide space it was
              made for, rather than squeezed into the narrow one. */}
          {profile.banner_url && (
            <div
              className="pf-banner"
              style={{ aspectRatio: bannerAspectRatio(custom?.banner_aspect) }}
            >
              <img src={profile.banner_url} alt="" />
            </div>
          )}
          </>
        }
      />
      </div>
    </ProfileScale>
  );
}
