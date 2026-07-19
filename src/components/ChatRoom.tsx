"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  userId: string;
  username: string;
};

type NewMessageRow = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
};

export function ChatRoom({
  initialMessages,
  userId,
  username,
}: {
  initialMessages: ChatMessage[];
  userId: string | null;
  username: string | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const usernameCache = useRef(new Map<string, string>());
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    for (const m of initialMessages) usernameCache.current.set(m.userId, m.username);
  }, [initialMessages]);

  useEffect(() => {
    const supabase = createClient();

    async function resolveUsername(id: string): Promise<string> {
      const cached = usernameCache.current.get(id);
      if (cached) return cached;

      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", id)
        .single();
      const name: string = profile?.username ?? "unknown";
      usernameCache.current.set(id, name);
      return name;
    }

    const channel = supabase
      .channel("chat_messages_inserts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        async (payload) => {
          const row = payload.new as NewMessageRow;
          const name = await resolveUsername(row.user_id);

          setMessages((prev) => [
            ...prev,
            {
              id: row.id,
              body: row.body,
              createdAt: row.created_at,
              userId: row.user_id,
              username: name,
            },
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [messages]);

  async function sendMessage() {
    const body = draft.trim();
    if (!body || !userId) return;
    setDraft("");

    const supabase = createClient();
    const { error } = await supabase.from("chat_messages").insert({
      user_id: userId,
      body,
    });
    if (error) {
      console.error(error.message);
    }
  }

  return (
    <div className="panel">
      <div className="panel-head">Live Chat</div>
      <div className="chat-body" ref={bodyRef}>
        {messages.length === 0 ? (
          <div className="empty-state">No messages yet — say something.</div>
        ) : (
          messages.map((m) => (
            <div className="chat-row" key={m.id}>
              <b>{m.username}:</b> {m.body}
            </div>
          ))
        )}
      </div>
      {userId ? (
        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage();
          }}
        >
          <input
            type="text"
            placeholder={`say something, ${username ?? "friend"}...`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button className="btn" type="submit">
            Send
          </button>
        </form>
      ) : (
        <div className="chat-signed-out">
          <Link href="/sign-in">Sign in</Link> or{" "}
          <Link href="/sign-up">create an account</Link> to join the chat.
        </div>
      )}
    </div>
  );
}
