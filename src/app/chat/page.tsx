import { createClient } from "@/lib/supabase/server";
import { ChatRoom, type ChatMessage } from "@/components/ChatRoom";
import { isAdmin } from "@/lib/admin";

type ChatMessageRow = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  profiles: { username: string } | null;
};

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rows } = await supabase
    .from("chat_messages")
    .select("id, body, created_at, user_id, profiles(username)")
    .order("created_at", { ascending: true })
    .limit(50)
    .returns<ChatMessageRow[]>();

  const messages: ChatMessage[] = (rows ?? []).map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    userId: row.user_id,
    username: row.profiles?.username ?? "unknown",
  }));

  let username: string | null = null;
  let blockedIds: string[] = [];
  let admin = false;
  if (user) {
    const [{ data: profile }, { data: blockRows }] = await Promise.all([
      supabase.from("profiles").select("username").eq("id", user.id).single(),
      supabase.from("blocked_users").select("blocked_id").eq("blocker_id", user.id),
    ]);
    username = profile?.username ?? null;
    blockedIds = (blockRows ?? []).map((r) => r.blocked_id);
    admin = await isAdmin(supabase, user.id);
  }

  return (
    <>
      <div className="page-header">
        <h1>Live Chat</h1>
        <div className="tagline">Based on what the community&apos;s into right now.</div>
      </div>
      <ChatRoom
        initialMessages={messages}
        userId={user?.id ?? null}
        username={username}
        blockedIds={blockedIds}
        isAdmin={admin}
      />
    </>
  );
}
