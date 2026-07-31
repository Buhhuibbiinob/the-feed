import type { SupabaseClient } from "@supabase/supabase-js";

export type ConversationSummary = {
  otherUserId: string;
  otherUsername: string;
  otherAvatarUrl: string | null;
  lastBody: string;
  lastCreatedAt: string;
  unreadCount: number;
};

export type ThreadMessage = {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

type MessageRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

async function getProfilesById(supabase: SupabaseClient, ids: string[]) {
  if (ids.length === 0) return new Map<string, { username: string; avatar_url: string | null }>();
  const { data } = await supabase.from("profiles").select("id, username, avatar_url").in("id", ids);
  return new Map((data ?? []).map((p) => [p.id as string, { username: p.username as string, avatar_url: p.avatar_url as string | null }]));
}

export async function getConversations(
  supabase: SupabaseClient,
  userId: string
): Promise<ConversationSummary[]> {
  const { data } = await supabase
    .from("direct_messages")
    .select("id, sender_id, recipient_id, body, created_at, read_at")
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .returns<MessageRow[]>();

  const rows = data ?? [];
  const byOther = new Map<string, MessageRow>();
  const unreadByOther = new Map<string, number>();

  for (const row of rows) {
    const otherId = row.sender_id === userId ? row.recipient_id : row.sender_id;
    if (!byOther.has(otherId)) byOther.set(otherId, row);
    if (row.recipient_id === userId && !row.read_at) {
      unreadByOther.set(otherId, (unreadByOther.get(otherId) ?? 0) + 1);
    }
  }

  const otherIds = [...byOther.keys()];
  const profiles = await getProfilesById(supabase, otherIds);

  return otherIds
    .map((otherId) => {
      const last = byOther.get(otherId)!;
      const profile = profiles.get(otherId);
      return {
        otherUserId: otherId,
        otherUsername: profile?.username ?? "unknown",
        otherAvatarUrl: profile?.avatar_url ?? null,
        lastBody: last.body,
        lastCreatedAt: last.created_at,
        unreadCount: unreadByOther.get(otherId) ?? 0,
      };
    })
    .sort((a, b) => new Date(b.lastCreatedAt).getTime() - new Date(a.lastCreatedAt).getTime());
}

export async function getThread(
  supabase: SupabaseClient,
  userId: string,
  otherUserId: string
): Promise<ThreadMessage[]> {
  const { data } = await supabase
    .from("direct_messages")
    .select("id, sender_id, recipient_id, body, created_at, read_at")
    .or(
      `and(sender_id.eq.${userId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${userId})`
    )
    .order("created_at", { ascending: true })
    .returns<MessageRow[]>();

  return (data ?? []).map((row) => ({
    id: row.id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at,
  }));
}

export async function markThreadRead(supabase: SupabaseClient, userId: string, otherUserId: string) {
  await supabase
    .from("direct_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", userId)
    .eq("sender_id", otherUserId)
    .is("read_at", null);
}

export async function getUnreadDmCount(supabase: SupabaseClient, userId: string): Promise<number> {
  const { count } = await supabase
    .from("direct_messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .is("read_at", null);
  return count ?? 0;
}
