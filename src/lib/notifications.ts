import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationType =
  | "like"
  | "comment"
  | "follow"
  | "view"
  | "reaction"
  | "twin"
  | "reply";

export type NotificationItem = {
  id: string;
  type: NotificationType;
  actorUsername: string;
  actorAvatarUrl: string | null;
  postId: string | null;
  postTitle: string | null;
  /** The pick that was reacted to, or the emoji used - shown in the row. */
  subject: string | null;
  emoji: string | null;
  createdAt: string;
};

type ProfileRef = { username: string; avatar_url: string | null } | { username: string; avatar_url: string | null }[] | null;

type RelatedRow = {
  post_id: string;
  created_at: string;
  profiles: ProfileRef;
};

type FollowRow = {
  created_at: string;
  profiles: ProfileRef;
};

type ViewRow = {
  created_at: string;
  profiles: ProfileRef;
};

type ReplyRow = {
  post_id: string;
  created_at: string;
  profiles: ProfileRef;
};

type ReactionRow = {
  emoji: string;
  created_at: string;
  profiles: ProfileRef;
  profile_favorites: { title: string } | { title: string }[] | null;
};

function firstProfile(profiles: ProfileRef): { username: string; avatar_url: string | null } | null {
  if (!profiles) return null;
  return Array.isArray(profiles) ? profiles[0] ?? null : profiles;
}

const RECENT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

async function getOwnPostIdsAndTitles(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from("posts").select("id, title").eq("user_id", userId);
  const rows = data ?? [];
  return {
    ids: rows.map((r) => r.id as string),
    titleById: new Map(rows.map((r) => [r.id as string, r.title as string])),
  };
}

/**
 * The taste-twin notification is not an event log like the others - there
 * is no row written when a twin changes. It's derived by comparing the
 * current twin against the last one the member was told about, so it fires
 * once per new twin and goes quiet again after they've seen it.
 */
async function getTwinNotification(
  supabase: SupabaseClient,
  userId: string,
  since: Date
): Promise<NotificationItem[]> {
  const { data } = await supabase
    .from("profiles")
    .select("taste_twin_id, taste_twin_score, taste_twin_at, taste_twin_announced_id")
    .eq("id", userId)
    .maybeSingle();

  const twinId = data?.taste_twin_id as string | null | undefined;
  if (!twinId || twinId === data?.taste_twin_announced_id) return [];

  const computedAt = data?.taste_twin_at as string | null | undefined;
  if (!computedAt || new Date(computedAt).getTime() < since.getTime()) return [];

  const { data: twinProfile } = await supabase
    .from("profiles")
    .select("username, avatar_url")
    .eq("id", twinId)
    .maybeSingle();
  if (!twinProfile) return [];

  return [
    {
      id: `twin-${twinId}-${computedAt}`,
      type: "twin",
      actorUsername: twinProfile.username as string,
      actorAvatarUrl: (twinProfile.avatar_url as string | null) ?? null,
      postId: null,
      postTitle: null,
      subject: data?.taste_twin_score != null ? `${data.taste_twin_score}%` : null,
      emoji: null,
      createdAt: computedAt,
    },
  ];
}

export async function getNotifications(
  supabase: SupabaseClient,
  userId: string,
  since: Date = new Date(Date.now() - RECENT_WINDOW_MS)
): Promise<NotificationItem[]> {
  const sinceIso = since.toISOString();

  // These four only establish *what belongs to this member* - none of them
  // depends on the others. Run in parallel: this function is called from
  // the root layout for the bell count on every single page load, so a
  // chain of round trips here is latency on every request in the app.
  //
  // Replies are notified off the member's own comments, not their posts -
  // "someone replied to you" in a thread on somebody else's review is
  // exactly the pull a passive leaderboard never provides.
  const [own, { data: favoriteRows }, { data: ownCommentRows }, twin] = await Promise.all([
    getOwnPostIdsAndTitles(supabase, userId),
    supabase.from("profile_favorites").select("id").eq("user_id", userId),
    supabase.from("comments").select("id").eq("user_id", userId),
    getTwinNotification(supabase, userId, since),
  ]);

  const { ids: postIds, titleById } = own;
  const favoriteIds = (favoriteRows ?? []).map((row) => row.id as string);
  const ownCommentIds = (ownCommentRows ?? []).map((row) => row.id as string);

  const [likesRes, commentsRes, followsRes, viewsRes, reactionsRes, repliesRes] =
    await Promise.all([
    postIds.length === 0
      ? Promise.resolve({ data: [] as RelatedRow[] })
      : supabase
          .from("likes")
          .select("post_id, created_at, profiles(username, avatar_url)")
          .in("post_id", postIds)
          .neq("user_id", userId)
          .gte("created_at", sinceIso)
          .order("created_at", { ascending: false })
          .limit(20)
          .returns<RelatedRow[]>(),
    postIds.length === 0
      ? Promise.resolve({ data: [] as RelatedRow[] })
      : supabase
          .from("comments")
          .select("post_id, created_at, profiles(username, avatar_url)")
          .in("post_id", postIds)
          .neq("user_id", userId)
          .gte("created_at", sinceIso)
          .order("created_at", { ascending: false })
          .limit(20)
          .returns<RelatedRow[]>(),
    supabase
      .from("follows")
      .select("created_at, profiles!follows_follower_id_fkey(username, avatar_url)")
      .eq("followed_id", userId)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<FollowRow[]>(),
    supabase
      .from("profile_views")
      .select("created_at, profiles!profile_views_viewer_id_fkey(username, avatar_url)")
      .eq("profile_id", userId)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<ViewRow[]>(),
    favoriteIds.length === 0
      ? Promise.resolve({ data: [] as ReactionRow[] })
      : supabase
          .from("favorite_reactions")
          .select("emoji, created_at, profiles(username, avatar_url), profile_favorites(title)")
          .in("favorite_id", favoriteIds)
          .neq("user_id", userId)
          .gte("created_at", sinceIso)
          .order("created_at", { ascending: false })
          .limit(20)
          .returns<ReactionRow[]>(),
    ownCommentIds.length === 0
      ? Promise.resolve({ data: [] as ReplyRow[] })
      : supabase
          .from("comments")
          .select("post_id, created_at, profiles(username, avatar_url)")
          .in("parent_comment_id", ownCommentIds)
          .neq("user_id", userId)
          .gte("created_at", sinceIso)
          .order("created_at", { ascending: false })
          .limit(20)
          .returns<ReplyRow[]>(),
  ]);

  const likes: NotificationItem[] = (likesRes.data ?? []).map((row) => {
    const profile = firstProfile(row.profiles);
    return {
      id: `like-${row.post_id}-${row.created_at}`,
      type: "like" as const,
      actorUsername: profile?.username ?? "someone",
      actorAvatarUrl: profile?.avatar_url ?? null,
      postId: row.post_id,
      postTitle: titleById.get(row.post_id) ?? null,
      subject: null,
      emoji: null,
      createdAt: row.created_at,
    };
  });

  const comments: NotificationItem[] = (commentsRes.data ?? []).map((row) => {
    const profile = firstProfile(row.profiles);
    return {
      id: `comment-${row.post_id}-${row.created_at}`,
      type: "comment" as const,
      actorUsername: profile?.username ?? "someone",
      actorAvatarUrl: profile?.avatar_url ?? null,
      postId: row.post_id,
      postTitle: titleById.get(row.post_id) ?? null,
      subject: null,
      emoji: null,
      createdAt: row.created_at,
    };
  });

  const follows: NotificationItem[] = (followsRes.data ?? []).map((row) => {
    const profile = firstProfile(row.profiles);
    return {
      id: `follow-${profile?.username}-${row.created_at}`,
      type: "follow" as const,
      actorUsername: profile?.username ?? "someone",
      actorAvatarUrl: profile?.avatar_url ?? null,
      postId: null,
      postTitle: null,
      subject: null,
      emoji: null,
      createdAt: row.created_at,
    };
  });

  const views: NotificationItem[] = (viewsRes.data ?? []).map((row) => {
    const profile = firstProfile(row.profiles);
    return {
      id: `view-${profile?.username}-${row.created_at}`,
      type: "view" as const,
      actorUsername: profile?.username ?? "someone",
      actorAvatarUrl: profile?.avatar_url ?? null,
      postId: null,
      postTitle: null,
      subject: null,
      emoji: null,
      createdAt: row.created_at,
    };
  });

  const reactions: NotificationItem[] = (reactionsRes.data ?? []).map((row) => {
    const profile = firstProfile(row.profiles);
    const pick = Array.isArray(row.profile_favorites)
      ? row.profile_favorites[0] ?? null
      : row.profile_favorites;
    return {
      id: `reaction-${profile?.username}-${row.created_at}`,
      type: "reaction" as const,
      actorUsername: profile?.username ?? "someone",
      actorAvatarUrl: profile?.avatar_url ?? null,
      postId: null,
      postTitle: null,
      subject: pick?.title ?? null,
      emoji: row.emoji,
      createdAt: row.created_at,
    };
  });

  const replies: NotificationItem[] = (repliesRes.data ?? []).map((row) => {
    const profile = firstProfile(row.profiles);
    return {
      id: `reply-${row.post_id}-${row.created_at}`,
      type: "reply" as const,
      actorUsername: profile?.username ?? "someone",
      actorAvatarUrl: profile?.avatar_url ?? null,
      postId: row.post_id,
      postTitle: null,
      subject: null,
      emoji: null,
      createdAt: row.created_at,
    };
  });

  return [
    ...likes,
    ...comments,
    ...follows,
    ...views,
    ...reactions,
    ...replies,
    ...twin,
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 30);
}

export async function getNotificationCount(
  supabase: SupabaseClient,
  userId: string,
  seenAt: string | null = null
): Promise<number> {
  const items = await getNotifications(supabase, userId);
  if (!seenAt) return items.length;
  const seenTime = new Date(seenAt).getTime();
  return items.filter((item) => new Date(item.createdAt).getTime() > seenTime).length;
}
