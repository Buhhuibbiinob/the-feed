import type { SupabaseClient } from "@supabase/supabase-js";

export type NotificationItem = {
  id: string;
  type: "like" | "comment" | "follow";
  actorUsername: string;
  actorAvatarUrl: string | null;
  postId: string | null;
  postTitle: string | null;
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

export async function getNotifications(
  supabase: SupabaseClient,
  userId: string,
  since: Date = new Date(Date.now() - RECENT_WINDOW_MS)
): Promise<NotificationItem[]> {
  const { ids: postIds, titleById } = await getOwnPostIdsAndTitles(supabase, userId);
  const sinceIso = since.toISOString();

  const [likesRes, commentsRes, followsRes] = await Promise.all([
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
      createdAt: row.created_at,
    };
  });

  return [...likes, ...comments, ...follows]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 30);
}

export async function getNotificationCount(supabase: SupabaseClient, userId: string): Promise<number> {
  const items = await getNotifications(supabase, userId);
  return items.length;
}
