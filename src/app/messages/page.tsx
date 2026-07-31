import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getConversations } from "@/lib/messages";

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function MessagesInboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const conversations = await getConversations(supabase, user.id);

  return (
    <div className="panel">
      <div className="panel-head">Messages</div>
      <div className="panel-body flush">
        {conversations.length === 0 ? (
          <div className="empty-state" style={{ padding: 16 }}>
            No conversations yet - visit a profile and send someone a message.
          </div>
        ) : (
          conversations.map((c) => (
            <Link href={`/messages/${c.otherUsername}`} key={c.otherUserId} className="dm-inbox-row">
              <img src={c.otherAvatarUrl || "/avatars/preset-1.svg"} alt="" className="dm-inbox-avatar" />
              <div className="dm-inbox-info">
                <b>{c.otherUsername}</b>
                <span>{c.lastBody}</span>
              </div>
              <div className="dm-inbox-meta">
                <span className="dm-inbox-time">{timeAgo(c.lastCreatedAt)}</span>
                {c.unreadCount > 0 && <span className="nav-bell-badge dm-inbox-unread">{c.unreadCount}</span>}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
