import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PostCard } from "@/components/PostCard";
import { PreviewPlayer } from "@/components/PreviewPlayer";
import { FollowButton } from "@/components/FollowButton";
import { AvatarPicker } from "@/components/AvatarPicker";
import { ProfileCustomize } from "@/components/ProfileCustomize";
import { ProfileLayoutEditor } from "@/components/ProfileLayoutEditor";
import { ProfileSkinEditor } from "@/components/ProfileSkinEditor";
import { ObsessedPicker } from "@/components/ObsessedPicker";
import { ProfileSongPicker } from "@/components/ProfileSongPicker";
import { FavoritesEditor } from "@/components/FavoritesEditor";
import { StatusPicker } from "@/components/StatusPicker";
import { MEDIA_LABELS, MEDIA_TYPES, type MediaType } from "@/lib/media";
import { computeTasteMatch } from "@/lib/taste";
import { earnedBadges, BADGES } from "@/lib/badges";
import { computeStreak } from "@/lib/streak";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { bannerAspectRatio } from "@/lib/bannerShape";
import { fontStack, hasSkin, skinStyle, type ProfileSkin } from "@/lib/profileSkin";
import { renderRichBio } from "@/lib/richBio";
import { resolveProfileLayout, type ProfileSectionId } from "@/lib/profileLayout";
import {
  FAVORITE_KINDS,
  FAVORITE_LABELS,
  groupFavorites,
  type Favorite,
  type FavoriteKind,
} from "@/lib/favorites";
import { OBSESSED_LABELS, isObsessedKind } from "@/lib/obsessed";

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
};

const CUSTOMIZATION_COLUMNS =
  "banner_aspect, bio_font, bio_color, profile_bg_color, profile_panel_color, profile_text_color, " +
  "profile_accent_color, profile_layout, obsessed_kind, obsessed_title, obsessed_note, " +
  "obsessed_image_url, profile_song_youtube_id, profile_song_spotify_id, profile_song_title, " +
  "profile_song_artist, profile_song_thumbnail_url, profile_song_autoplay";

type FavoriteRow = {
  id: string;
  kind: FavoriteKind;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  position: number;
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

  let isFollowing = false;
  let tasteMatch: number | null = null;
  if (user && !isOwnProfile) {
    const [{ data: followRow }, { data: myPostRows }, { data: myClubRows }] = await Promise.all([
      supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", user.id)
        .eq("followed_id", profile.id)
        .maybeSingle(),
      supabase.from("posts").select("club_id, rating").eq("user_id", user.id),
      supabase.from("club_members").select("club_id").eq("user_id", user.id),
    ]);
    isFollowing = !!followRow;

    const theirRatings = new Map<string, number[]>();
    for (const post of posts) {
      if (!post.club_id || post.rating == null) continue;
      const ratings = theirRatings.get(post.club_id) ?? [];
      ratings.push(post.rating);
      theirRatings.set(post.club_id, ratings);
    }
    const theirClubIds = new Set(clubs.map((c) => c.id));

    const myRatings = new Map<string, number[]>();
    for (const post of myPostRows ?? []) {
      if (!post.club_id || post.rating == null) continue;
      const ratings = myRatings.get(post.club_id) ?? [];
      ratings.push(post.rating);
      myRatings.set(post.club_id, ratings);
    }
    const myClubIds = new Set((myClubRows ?? []).map((r) => r.club_id));

    tasteMatch = computeTasteMatch(myRatings, myClubIds, theirRatings, theirClubIds);
  }

  const skin: ProfileSkin = {
    bg: custom?.profile_bg_color ?? null,
    panel: custom?.profile_panel_color ?? null,
    text: custom?.profile_text_color ?? null,
    accent: custom?.profile_accent_color ?? null,
  };
  const bioStyle = {
    fontFamily: fontStack(custom?.bio_font) ?? undefined,
    color: custom?.bio_color ?? undefined,
  };

  const obsessedKind = isObsessedKind(custom?.obsessed_kind) ? custom.obsessed_kind : null;
  const obsessedTitle = custom?.obsessed_title ?? null;
  const songId = custom?.profile_song_youtube_id ?? null;
  const songSpotifyId = custom?.profile_song_spotify_id ?? null;
  const hasSong = !!(songId || songSpotifyId);

  const layout = resolveProfileLayout(custom?.profile_layout);

  // A section with nothing in it is hidden from visitors and shown to the
  // owner as a prompt - an empty panel on someone else's profile just reads
  // as "nobody uses this".
  const sectionHasContent: Record<ProfileSectionId, boolean> = {
    obsessed: !!obsessedTitle,
    song: hasSong,
    favorites: favoriteCount > 0,
    stats: MEDIA_TYPES.some((mt) => breakdown[mt] > 0),
    clubs: clubs.length > 0,
    reviews: posts.length > 0,
  };

  function renderSection(id: ProfileSectionId) {
    switch (id) {
      case "obsessed":
        return (
          <div className="panel" key={id}>
            <div className="panel-head">Currently obsessed with</div>
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
                <EmptySlot>Pin the one thing you can&apos;t stop playing or watching.</EmptySlot>
              )}
            </div>
          </div>
        );

      case "song":
        return (
          <div className="panel" key={id}>
            <div className="panel-head">Profile song</div>
            <div className="panel-body">
              {hasSong ? (
                <PreviewPlayer
                  youtubeVideoId={songId}
                  spotifyTrackId={songSpotifyId}
                  label={custom?.profile_song_title ?? "Profile song"}
                  autoplay={custom?.profile_song_autoplay === true}
                />
              ) : (
                <EmptySlot>Pick the track that plays when someone lands here.</EmptySlot>
              )}
            </div>
          </div>
        );

      case "favorites":
        return (
          <div className="panel" key={id}>
            <div className="panel-head">Top artists, movies &amp; shows</div>
            <div className="panel-body">
              {favoriteCount === 0 ? (
                <EmptySlot>Build your top eight - hand-picked, not counted up from your reviews.</EmptySlot>
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
                            <span>
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
          <div className="panel" key={id}>
            <div className="panel-head">Stats</div>
            <div className="stats-body">
              {/* Only categories they've actually posted in. Otherwise every
                  profile would carry a permanent "0 Photography reviews" line
                  the day the category shipped. */}
              {MEDIA_TYPES.filter((mt) => breakdown[mt] > 0).length === 0 ? (
                <div>No reviews yet.</div>
              ) : (
                MEDIA_TYPES.filter((mt) => breakdown[mt] > 0).map((mt) => (
                  <div key={mt}>
                    {breakdown[mt]} {MEDIA_LABELS[mt]} review{breakdown[mt] === 1 ? "" : "s"}
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case "clubs":
        return (
          <div className="panel" key={id}>
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
          <div className="panel" key={id}>
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

  return (
    <div className={hasSkin(skin) ? "profile-skin" : undefined} style={skinStyle(skin)}>
      <div
        className="panel profile-head"
        style={
          profile.banner_url
            ? {
                backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.55)), url(${profile.banner_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                // The head takes the shape the banner was cropped to, so a
                // tall banner isn't squashed into a wide strip.
                aspectRatio: bannerAspectRatio(custom?.banner_aspect),
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
            <div className="profile-username" style={profile.name_color ? { color: profile.name_color } : undefined}>
              {profile.username}
              {profile.is_verified && <VerifiedBadge />}
            </div>
            {profile.bio && (
              <div className="profile-bio" style={bioStyle}>
                {renderRichBio(profile.bio)}
              </div>
            )}
            {status?.status_media_type && (
              <div className="profile-status">
                {status.status_media_type === "music" ? "Listening to " : "Watching "}
                <b>{status.status_title}</b>
                {status.status_artist && <> - {status.status_artist}</>}
              </div>
            )}
            <div className="profile-counts">
              <span>{posts.length} reviews</span>
              <span>{totalFollowerCount} followers</span>
              <span>{followingCount ?? 0} following</span>
              <span>{totalLikesReceived} likes</span>
              {tasteMatch !== null && <span className="taste-match">{tasteMatch}% taste match</span>}
              {streak > 1 && <span className="streak-count">{streak} day streak</span>}
            </div>
            {badges.length > 0 && (
              <div className="profile-badges">
                {badges.map((b) => (
                  <span key={b.id} className="profile-badge" title={`${b.label} - ${b.threshold}+ reviews`}>
                    {b.label}
                  </span>
                ))}
              </div>
            )}
            {nextBadge && (
              <div className="profile-badge-next">
                {nextBadge.threshold - posts.length} more review
                {nextBadge.threshold - posts.length === 1 ? "" : "s"} to unlock {nextBadge.label}
              </div>
            )}
            {!isOwnProfile && user && (
              <div className="profile-actions">
                <FollowButton
                  followedId={profile.id}
                  username={profile.username}
                  following={isFollowing}
                />
                <Link href={`/messages/${profile.username}`} className="btn btn-ghost">
                  Message
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* The owner's controls live in their own panel rather than in the
          head. There are eight of them now, and stacked inside the banner
          they buried the profile they're meant to be editing. */}
      {isOwnProfile && (
        <div className="panel profile-editor-panel">
          <div className="panel-head">Customize your profile</div>
          <div className="panel-body">
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
              <ProfileSkinEditor skin={skin} />
              <ProfileLayoutEditor layout={layout} />
            </div>
          </div>
        </div>
      )}

      {layout
        .filter((entry) => entry.shown)
        .filter((entry) => isOwnProfile || sectionHasContent[entry.id])
        .map((entry) => renderSection(entry.id))}
    </div>
  );
}
