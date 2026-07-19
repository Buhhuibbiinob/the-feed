import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { adminDeleteMessage, adminDismissReport, adminBanUser, adminUnbanUser, adminRemoveUser } from "@/app/actions/admin";

type ReportRow = {
  id: string;
  created_at: string;
  chat_messages: { id: string; body: string; user_id: string; profiles: { username: string } | null } | null;
  profiles: { username: string } | null;
};

type ProfileRow = {
  id: string;
  username: string;
  is_admin: boolean;
  banned: boolean;
};

export const metadata = { title: "Admin — the feed" };

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isAdmin(supabase, user.id))) {
    notFound();
  }

  const [{ data: reportRows }, { data: profileRows }] = await Promise.all([
    supabase
      .from("message_reports")
      .select(
        "id, created_at, chat_messages(id, body, user_id, profiles(username)), profiles!message_reports_reporter_id_fkey(username)"
      )
      .order("created_at", { ascending: false })
      .returns<ReportRow[]>(),
    supabase
      .from("profiles")
      .select("id, username, is_admin, banned")
      .order("username", { ascending: true })
      .returns<ProfileRow[]>(),
  ]);

  const reports = reportRows ?? [];
  const profiles = profileRows ?? [];

  return (
    <>
      <div className="page-header">
        <h1>Admin</h1>
        <div className="tagline">Moderation tools — reported messages, users, bans.</div>
      </div>

      <div className="panel">
        <div className="panel-head">Reported Messages</div>
        <div className="panel-body flush">
          {reports.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>No reports right now.</div>
          ) : (
            reports.map((r) => (
              <div className="chat-row" key={r.id}>
                {r.chat_messages ? (
                  <>
                    <b>{r.chat_messages.profiles?.username ?? "unknown"}:</b> {r.chat_messages.body}
                  </>
                ) : (
                  <i>message deleted</i>
                )}
                <span className="chat-msg-actions">
                  <span className="comment-action">reported by {r.profiles?.username ?? "unknown"}</span>
                  {r.chat_messages && (
                    <form action={adminDeleteMessage} className="inline-form">
                      <input type="hidden" name="message_id" value={r.chat_messages.id} />
                      <button type="submit" className="comment-action danger">
                        Remove message
                      </button>
                    </form>
                  )}
                  <form action={adminDismissReport} className="inline-form">
                    <input type="hidden" name="report_id" value={r.id} />
                    <button type="submit" className="comment-action">
                      Dismiss
                    </button>
                  </form>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Users</div>
        <div className="panel-body flush">
          {profiles.map((p) => (
            <div className="chat-row" key={p.id}>
              <b>{p.username}</b>
              {p.is_admin && <span> · admin</span>}
              {p.banned && <span> · banned</span>}
              {!p.is_admin && (
                <span className="chat-msg-actions">
                  {p.banned ? (
                    <form action={adminUnbanUser} className="inline-form">
                      <input type="hidden" name="user_id" value={p.id} />
                      <button type="submit" className="comment-action">
                        Unban
                      </button>
                    </form>
                  ) : (
                    <form action={adminBanUser} className="inline-form">
                      <input type="hidden" name="user_id" value={p.id} />
                      <button type="submit" className="comment-action danger">
                        Ban
                      </button>
                    </form>
                  )}
                  <form action={adminRemoveUser} className="inline-form">
                    <input type="hidden" name="user_id" value={p.id} />
                    <button type="submit" className="comment-action danger">
                      Remove account
                    </button>
                  </form>
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
