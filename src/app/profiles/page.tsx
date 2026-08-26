import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProfileCard } from "@/components/ProfileCard";
import {
  DIRECTORY_SORTS,
  getDiscoverProfiles,
  isDirectorySort,
  profileOfTheWeek,
  sortProfiles,
} from "@/lib/discovery";
import { buildTasteProfile, tasteMatch } from "@/lib/taste";

export const metadata = { title: "Profiles" };

type PostRow = { user_id: string; title: string; artist: string | null; rating: number | null };

export default async function ProfilesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const active = isDirectorySort(sort) ? sort : "customized";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profiles = await getDiscoverProfiles(supabase);

  const { data: joinRows } = await supabase.from("profiles").select("id, created_at");
  const joinedAt = new Map(
    (joinRows ?? []).map((r) => [r.id as string, r.created_at as string])
  );

  const featured = profileOfTheWeek(profiles);

  // Taste match against whoever is reading, so the directory answers "who
  // should I follow" rather than just "who exists".
  const matches = new Map<string, number>();
  if (user) {
    const { data: postRows } = await supabase
      .from("posts")
      .select("user_id, title, artist, rating")
      .returns<PostRow[]>();

    const byUser = new Map<string, PostRow[]>();
    for (const row of postRows ?? []) {
      const list = byUser.get(row.user_id) ?? [];
      list.push(row);
      byUser.set(row.user_id, list);
    }

    const mine = buildTasteProfile({ posts: byUser.get(user.id) ?? [], clubIds: [] });
    for (const profile of profiles) {
      if (profile.id === user.id) continue;
      const theirs = buildTasteProfile({ posts: byUser.get(profile.id) ?? [], clubIds: [] });
      const score = tasteMatch(mine, theirs);
      if (score !== null) matches.set(profile.id, score);
    }
  }

  const ordered = sortProfiles(profiles, active, joinedAt);

  return (
    <>
      {featured && (
        <div className="panel">
          <div className="panel-head">Profile of the Day</div>
          <div className="panel-body">
            <ProfileCard profile={featured} match={matches.get(featured.id) ?? null} />
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">Profiles</div>
        <div className="feed-chips">
          {DIRECTORY_SORTS.map((option) => (
            <Link
              key={option.id}
              href={option.id === "customized" ? "/profiles" : `/profiles?sort=${option.id}`}
              className={`feed-chip ${active === option.id ? "active" : ""}`}
            >
              {option.label}
            </Link>
          ))}
        </div>
        <div className="panel-body">
          {ordered.length === 0 ? (
            <div className="empty-state">Nobody here yet.</div>
          ) : (
            <div className="profile-card-grid">
              {ordered.map((profile) => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  match={matches.get(profile.id) ?? null}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
