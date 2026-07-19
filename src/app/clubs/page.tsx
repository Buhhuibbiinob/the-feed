import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MEDIA_LABELS, type MediaType } from "@/lib/media";

type ClubRow = {
  id: string;
  media_type: MediaType;
  name: string;
  created_at: string;
};

export const metadata = { title: "Fan Clubs — the feed" };

export default async function ClubsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: clubRows }, { data: memberRows }] = await Promise.all([
    supabase
      .from("clubs")
      .select("id, media_type, name, created_at")
      .order("created_at", { ascending: false })
      .returns<ClubRow[]>(),
    supabase.from("club_members").select("club_id, user_id"),
  ]);

  const clubs = clubRows ?? [];

  const memberCounts = new Map<string, number>();
  const myClubIds = new Set<string>();
  for (const m of memberRows ?? []) {
    memberCounts.set(m.club_id, (memberCounts.get(m.club_id) ?? 0) + 1);
    if (user && m.user_id === user.id) myClubIds.add(m.club_id);
  }

  return (
    <>
      <div className="page-header">
        <h1>Fan Clubs</h1>
        <div className="tagline">
          Auto-created the first time someone posts about an artist, movie, or show.
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">All Clubs</div>
        <div className="panel-body flush">
          {clubs.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>
              No clubs yet — post a review and one will be created automatically.
            </div>
          ) : (
            clubs.map((club) => (
              <Link href={`/clubs/${club.id}`} className="club-row" key={club.id}>
                <span className={`badge ${club.media_type}`}>{MEDIA_LABELS[club.media_type]}</span>
                <span className="club-row-name">{club.name}</span>
                <span className="club-row-members">
                  {memberCounts.get(club.id) ?? 0} member{(memberCounts.get(club.id) ?? 0) === 1 ? "" : "s"}
                </span>
                {myClubIds.has(club.id) && <span className="club-row-joined">Joined</span>}
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  );
}
