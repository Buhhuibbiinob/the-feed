"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { reportMessage, blockUser, unblockUser, deleteOwnMessage } from "@/app/actions/moderation";
import { adminDeleteMessage } from "@/app/actions/admin";

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
  club_id: string | null;
};

export function ChatRoom({
  initialMessages,
  userId,
  username,
  blockedIds,
  isAdmin,
  clubId = null,
  heading = "Live Chat",
}: {
  initialMessages: ChatMessage[];
  userId: string | null;
  username: string | null;
  blockedIds: string[];
  isAdmin: boolean;
  clubId?: string | null;
  heading?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [blocked, setBlocked] = useState(new Set(blockedIds));
  const [reportedIds, setReportedIds] = useState(new Set<string>());
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
      .channel(`chat_messages_inserts_${clubId ?? "global"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        async (payload) => {
          const row = payload.new as NewMessageRow;
          if ((row.club_id ?? null) !== clubId) return;
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
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_messages" },
        (payload) => {
          const row = payload.old as { id: string };
          setMessages((prev) => prev.filter((m) => m.id !== row.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clubId]);

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
      club_id: clubId,
    });
    if (error) {
      console.error(error.message);
    }
  }

  function handleBlock(blockedId: string) {
    setBlocked((prev) => new Set(prev).add(blockedId));
  }

  function handleUnblock(blockedId: string) {
    setBlocked((prev) => {
      const next = new Set(prev);
      next.delete(blockedId);
      return next;
    });
  }

  const visibleMessages = messages.filter((m) => !blocked.has(m.userId));

  return (
    <div className="panel">
      <div className="panel-head">{heading}</div>
      <div className="chat-body" ref={bodyRef}>
        {visibleMessages.length === 0 ? (
          <div className="empty-state">No messages yet — say something.</div>
        ) : (
          visibleMessages.map((m) => {
            const isOwn = userId === m.userId;
            return (
              <div className="chat-row" key={m.id}>
                <b>{m.username}:</b> {m.body}
                {userId && (
                  <span className="chat-msg-actions">
                    {isOwn ? (
                      <form action={deleteOwnMessage} className="inline-form">
                        <input type="hidden" name="message_id" value={m.id} />
                        <button type="submit" className="comment-action danger">
                          Delete
                        </button>
                      </form>
                    ) : (
                      <>
                        {reportedIds.has(m.id) ? (
                          <span className="comment-action">Reported</span>
                        ) : (
                          <form
                            action={reportMessage}
                            className="inline-form"
                            onSubmit={() => setReportedIds((prev) => new Set(prev).add(m.id))}
                          >
                            <input type="hidden" name="message_id" value={m.id} />
                            <button type="submit" className="comment-action">
                              Report
                            </button>
                          </form>
                        )}
                        <form
                          action={blockUser}
                          className="inline-form"
                          onSubmit={() => handleBlock(m.userId)}
                        >
                          <input type="hidden" name="blocked_id" value={m.userId} />
                          <button type="submit" className="comment-action">
                            Block
                          </button>
                        </form>
                      </>
                    )}
                    {isAdmin && (
                      <form action={adminDeleteMessage} className="inline-form">
                        <input type="hidden" name="message_id" value={m.id} />
                        <button type="submit" className="comment-action danger">
                          Remove
                        </button>
                      </form>
                    )}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
      {userId ? (
        <>
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
          {blocked.size > 0 && (
            <div className="chat-blocked-list">
              Blocked:{" "}
              {[...blocked].map((id) => (
                <form
                  action={unblockUser}
                  className="inline-form"
                  key={id}
                  onSubmit={() => handleUnblock(id)}
                >
                  <input type="hidden" name="blocked_id" value={id} />
                  <button type="submit" className="comment-action">
                    {usernameCache.current.get(id) ?? "user"} (unblock)
                  </button>
                </form>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="chat-signed-out">
          <Link href="/sign-in">Sign in</Link> or{" "}
          <Link href="/sign-up">create an account</Link> to join the chat.
        </div>
      )}
    </div>
  );
}
