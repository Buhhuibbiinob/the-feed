import { createClient } from "@/lib/supabase/server";
import { ChatRoom, type ChatMessage } from "@/components/ChatRoom";

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
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();
    username = profile?.username ?? null;
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
      />
    </>
  );
}
