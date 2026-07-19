import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MEDIA_LABELS, type MediaType } from "@/lib/media";
import { isAdmin } from "@/lib/admin";
import { getAllSiteText } from "@/lib/siteContent";
import { CreateClubForm } from "@/components/CreateClubForm";

type ClubRow = {
  id: string;
  media_type: MediaType;
  name: string;
  created_at: string;
  status: "pending" | "approved" | "banned";
  created_by: string | null;
  avatar_url: string | null;
  banner_url: string | null;
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
    .select("id, media_type, name, created_at, status, created_by, avatar_url, banner_url")
    .order("created_at", { ascending: false });
  if (admin) {
    clubQuery = clubQuery.neq("status", "banned");
  } else if (user) {
    clubQuery = clubQuery.or(`status.eq.approved,created_by.eq.${user.id}`);
  } else {
    clubQuery = clubQuery.eq("status", "approved");
  }

  const [{ data: clubRows }, { data: memberRows }, siteText] = await Promise.all([
    clubQuery.returns<ClubRow[]>(),
    supabase.from("club_members").select("club_id, user_id"),
    getAllSiteText(supabase),
  ]);

  const memberCounts = new Map<string, number>();
  const myClubIds = new Set<string>();
  for (const m of memberRows ?? []) {
    memberCounts.set(m.club_id, (memberCounts.get(m.club_id) ?? 0) + 1);
    if (user && m.user_id === user.id) myClubIds.add(m.club_id);
  }

  const clubs = [...(clubRows ?? [])].sort(
    (a, b) => (memberCounts.get(b.id) ?? 0) - (memberCounts.get(a.id) ?? 0)
  );

  return (
    <>
      <div className="page-header">
        <h1>{siteText.clubs_heading}</h1>
        <div className="tagline">{siteText.clubs_tagline}</div>
      </div>

      <div className="panel">
        <div className="panel-head">
          Start a Club
          {!user && (
            <span style={{ fontWeight: 400, fontSize: 11 }}>
              {" — "}
              <Link href="/sign-in">Sign in</Link> to create one.
            </span>
          )}
        </div>
        <div className="panel-body">{user && <CreateClubForm />}</div>
      </div>

      <div className="panel">
        <div className="panel-head">All Clubs</div>
        <div className="panel-body flush">
          {clubs.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>{siteText.clubs_empty}</div>
          ) : (
            clubs.map((club) => (
              <Link href={`/clubs/${club.id}`} className="club-row" key={club.id}>
                {club.banner_url && (
                  <img src={club.banner_url} alt="" className="club-row-banner" />
                )}
                <img
                  src={club.avatar_url || "/avatars/preset-1.svg"}
                  alt=""
                  className="club-row-avatar"
                />
                <span className={`badge ${club.media_type}`}>{MEDIA_LABELS[club.media_type]}</span>
                <span className="club-row-name">{club.name}</span>
                {club.status === "pending" && <span className="club-row-joined">Pending review</span>}
                {user && club.created_by === user.id && (
                  <span className="club-row-joined">Yours</span>
                )}
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
