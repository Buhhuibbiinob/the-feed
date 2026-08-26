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

export default async function MessagesInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { tab } = await searchParams;
  const showRequests = tab === "requests";

  const conversations = await getConversations(supabase, user.id);
  const inbox = conversations.filter((c) => !c.isRequest);
  const requests = conversations.filter((c) => c.isRequest);
  const shown = showRequests ? requests : inbox;

  const requestUnread = requests.reduce((n, c) => n + c.unreadCount, 0);
  const inboxUnread = inbox.reduce((n, c) => n + c.unreadCount, 0);

  return (
    <div className="panel">
      <div className="panel-head">Messages</div>
      <div className="panel-body flush">
        {/* Requests only get their own tab once one exists. Showing an
            always-empty second tab to the 12 people who have never had a
            message request is just clutter. */}
        {requests.length > 0 && (
          <div className="dm-tabs">
            <Link href="/messages" className={`dm-tab${showRequests ? "" : " active"}`}>
              Inbox{inboxUnread > 0 ? ` (${inboxUnread})` : ""}
            </Link>
            <Link href="/messages?tab=requests" className={`dm-tab${showRequests ? " active" : ""}`}>
              Requests{requestUnread > 0 ? ` (${requestUnread})` : ""}
            </Link>
          </div>
        )}

        {showRequests && (
          <div className="dm-requests-note">
            People you don&apos;t follow who messaged first. Reply once and they move to your inbox.
          </div>
        )}

        {shown.length === 0 ? (
          <div className="empty-state" style={{ padding: 16 }}>
            {showRequests
              ? "No requests."
              : "Nothing here yet. Go to someone's profile and say something."}
          </div>
        ) : (
          shown.map((c) => (
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
