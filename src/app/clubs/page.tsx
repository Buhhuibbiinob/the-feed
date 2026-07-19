import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MEDIA_LABELS, type MediaType } from "@/lib/media";
import { isAdmin } from "@/lib/admin";
import { getAllSiteText } from "@/lib/siteContent";

type ClubRow = {
  id: string;
  media_type: MediaType;
  name: string;
  created_at: string;
  status: "pending" | "approved" | "banned";
};

export const metadata = { title: "Fan Clubs — the feed" };

export default async function ClubsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = user ? await isAdmin(supabase, user.id) : false;

  let clubQuery = supabase
    .from("clubs")
    .select("id, media_type, name, created_at, status")
    .order("created_at", { ascending: false });
  if (!admin) {
    clubQuery = clubQuery.eq("status", "approved");
  } else {
    clubQuery = clubQuery.neq("status", "banned");
  }

  const [{ data: clubRows }, { data: memberRows }, siteText] = await Promise.all([
    clubQuery.returns<ClubRow[]>(),
    supabase.from("club_members").select("club_id, user_id"),
    getAllSiteText(supabase),
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
        <h1>{siteText.clubs_heading}</h1>
        <div className="tagline">{siteText.clubs_tagline}</div>
      </div>

      <div className="panel">
        <div className="panel-head">All Clubs</div>
        <div className="panel-body flush">
          {clubs.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>{siteText.clubs_empty}</div>
          ) : (
            clubs.map((club) => (
              <Link href={`/clubs/${club.id}`} className="club-row" key={club.id}>
                <span className={`badge ${club.media_type}`}>{MEDIA_LABELS[club.media_type]}</span>
                <span className="club-row-name">{club.name}</span>
                {club.status === "pending" && <span className="club-row-joined">Pending review</span>}
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
