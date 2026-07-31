import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getThread, markThreadRead } from "@/lib/messages";
import { MessageComposer } from "@/components/MessageComposer";

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: otherProfile } = await supabase
    .from("profiles")
    .select("id, username, avatar_url")
    .eq("username", username)
    .maybeSingle();

  if (!otherProfile) notFound();
  if (otherProfile.id === user.id) redirect("/messages");

  await markThreadRead(supabase, user.id, otherProfile.id);
  const messages = await getThread(supabase, user.id, otherProfile.id);

  return (
    <div className="panel">
      <div className="panel-head">
        <Link href={`/profile/${otherProfile.username}`}>{otherProfile.username}</Link>
      </div>
      <div className="panel-body flush dm-thread-body">
        {messages.length === 0 ? (
          <div className="empty-state" style={{ padding: 16 }}>
            No messages yet - say hello.
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`dm-bubble-row ${m.senderId === user.id ? "mine" : ""}`}>
              <div className="dm-bubble">
                <div>{m.body}</div>
                <span className="dm-bubble-time">{timeAgo(m.createdAt)}</span>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="panel-body">
        <MessageComposer recipientId={otherProfile.id} recipientUsername={otherProfile.username} />
      </div>
    </div>
  );
}
