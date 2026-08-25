import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { guardBuiltinPage } from "@/lib/pages";
import {
  computeWeeklyBoards,
  type LeaderboardEntry,
  type LeaderboardMember,
  type LeaderboardPost,
} from "@/lib/weeklyLeaderboard";

export const metadata = { title: "Leaderboard" };

type ProfileRow = { id: string; username: string; avatar_url: string | null };
type PostRow = {
  user_id: string;
  title: string;
  artist: string | null;
  rating: number | null;
  created_at: string;
};

function Board({
  title,
  blurb,
  entries,
  emptyMessage,
}: {
  title: string;
  blurb: string;
  entries: LeaderboardEntry[];
  emptyMessage: string;
}) {
  return (
    <div className="panel">
      <div className="panel-head">{title}</div>
      <div className="panel-body" style={{ paddingBottom: 0 }}>
        <p className="field-hint" style={{ marginTop: 0 }}>
          {blurb}
        </p>
      </div>
      <div className="side-list">
        {entries.length === 0 ? (
          <div className="empty-state">{emptyMessage}</div>
        ) : (
          entries.map((entry, i) => (
            <div className="row" key={entry.member.id}>
              <span className="num">{i + 1}</span>
              <img
                src={entry.member.avatarUrl || "/avatars/preset-1.svg"}
                alt=""
                className="leaderboard-avatar"
              />
              <div className="info">
                <b>
                  <Link href={`/profile/${entry.member.username}`}>{entry.member.username}</Link>
                </b>
                <span>{entry.detail}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default async function LeaderboardPage() {
  const supabase = await createClient();
  await guardBuiltinPage(supabase, "leaderboard");

  const [{ data: profiles }, { data: posts }] = await Promise.all([
    // Bots are left out: they post on a schedule and would hold every board
    // permanently, which is the fastest way to make a leaderboard ignorable.
    supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .eq("is_bot", false)
      .eq("banned", false)
      .returns<ProfileRow[]>(),
    supabase
      .from("posts")
      .select("user_id, title, artist, rating, created_at")
      .returns<PostRow[]>(),
  ]);

  const members: LeaderboardMember[] = (profiles ?? []).map((p) => ({
    id: p.id,
    username: p.username,
    avatarUrl: p.avatar_url,
  }));
  const memberIds = new Set(members.map((m) => m.id));

  const leaderboardPosts: LeaderboardPost[] = (posts ?? [])
    .filter((p) => memberIds.has(p.user_id))
    .map((p) => ({
      userId: p.user_id,
      title: p.title,
      artist: p.artist,
      rating: p.rating,
      createdAt: p.created_at,
    }));

  const boards = computeWeeklyBoards(members, leaderboardPosts);

  return (
    <>
      <div className="panel">
        <div className="panel-head">This week</div>
        <div className="panel-body">
          <p className="field-hint" style={{ margin: 0 }}>
            Every board below covers the last seven days and recalculates itself, so nobody builds
            an unbeatable all-time lead and the standings are worth checking again next week.
          </p>
        </div>
      </div>

      <Board
        title="Top Reviewer"
        blurb="Most reviews posted in the last seven days."
        entries={boards.topReviewer}
        emptyMessage="Nobody has posted a review this week yet."
      />

      <Board
        title="Best Taste"
        blurb="Whose ratings line up closest with everyone else's on the things you've both seen or heard. Being in tune with the room, not being liked by it."
        entries={boards.bestTaste}
        emptyMessage="Not enough overlapping reviews yet to compare anyone's taste."
      />

      <Board
        title="Fastest Rising"
        blurb="Biggest jump in reviews against the week before."
        entries={boards.fastestRising}
        emptyMessage="No one has stepped up their posting this week yet."
      />
    </>
  );
}
