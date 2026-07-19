import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type ProfileRow = {
  id: string;
  username: string;
  avatar_url: string | null;
};

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const [{ data: profiles }, { data: posts }] = await Promise.all([
    supabase.from("profiles").select("id, username, avatar_url").returns<ProfileRow[]>(),
    supabase.from("posts").select("user_id"),
  ]);

  const counts = new Map<string, number>();
  for (const post of posts ?? []) {
    counts.set(post.user_id, (counts.get(post.user_id) ?? 0) + 1);
  }

  const ranked = (profiles ?? [])
    .map((p) => ({ ...p, count: counts.get(p.id) ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  return (
    <div className="panel">
      <div className="panel-head">Leaderboard</div>
      <div className="side-list">
        {ranked.length === 0 ? (
          <div className="empty-state">No reviewers yet.</div>
        ) : (
          ranked.map((p, i) => (
            <div className="row" key={p.id}>
              <span className="num">{i + 1}</span>
              <img
                src={p.avatar_url || "/avatars/preset-1.svg"}
                alt=""
                className="leaderboard-avatar"
              />
              <div className="info">
                <b>
                  <Link href={`/profile/${p.username}`}>{p.username}</Link>
                </b>
                <span>
                  {p.count} review{p.count === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
