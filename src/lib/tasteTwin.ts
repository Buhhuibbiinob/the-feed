import type { SupabaseClient } from "@supabase/supabase-js";
import { buildTasteProfile, sharedWorkCount, tasteMatch, type TasteProfile } from "@/lib/taste";

// The "taste twin" is the member whose reviews line up most closely with
// yours. Finding it means reading everyone's reviews, so the answer is
// cached on the profile and only recomputed when it has gone stale.

export const TWIN_REFRESH_MS = 3 * 24 * 60 * 60 * 1000;

// Below this the callout is noise - two people who happened to both watch
// one popular film are not twins.
const MIN_TWIN_SCORE = 40;
const MIN_SHARED_WORKS = 1;

// Cap on how much review history is pulled in for the comparison. Recent
// reviews are the ones that describe someone's taste now, and an unbounded
// read here would be the slowest query on the site.
const POST_SCAN_LIMIT = 5000;

export type TasteTwin = {
  id: string;
  username: string;
  avatarUrl: string | null;
  score: number;
};

type PostRow = { user_id: string; title: string; artist: string | null; rating: number | null };
type ClubRow = { user_id: string; club_id: string };
type CandidateRow = { id: string; username: string; avatar_url: string | null };

export function twinIsStale(computedAt: string | null | undefined, now = Date.now()): boolean {
  if (!computedAt) return true;
  return now - new Date(computedAt).getTime() > TWIN_REFRESH_MS;
}

/**
 * Recomputes and stores the member's taste twin. Returns the twin's id, or
 * null when nobody clears the bar - which is written back too, so a member
 * with no match doesn't trigger a full rescan on every page view.
 */
export async function refreshTasteTwin(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const [{ data: postRows }, { data: clubRows }, { data: candidateRows }] = await Promise.all([
    supabase
      .from("posts")
      .select("user_id, title, artist, rating")
      .order("created_at", { ascending: false })
      .limit(POST_SCAN_LIMIT)
      .returns<PostRow[]>(),
    supabase.from("club_members").select("user_id, club_id").returns<ClubRow[]>(),
    // Bots review constantly and would win this every time; a twin has to
    // be someone you could actually message back.
    supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .eq("is_bot", false)
      .eq("banned", false)
      .neq("id", userId)
      .returns<CandidateRow[]>(),
  ]);

  const postsByUser = new Map<string, PostRow[]>();
  for (const post of postRows ?? []) {
    const list = postsByUser.get(post.user_id) ?? [];
    list.push(post);
    postsByUser.set(post.user_id, list);
  }

  const clubsByUser = new Map<string, string[]>();
  for (const row of clubRows ?? []) {
    const list = clubsByUser.get(row.user_id) ?? [];
    list.push(row.club_id);
    clubsByUser.set(row.user_id, list);
  }

  const profileFor = (id: string): TasteProfile =>
    buildTasteProfile({ posts: postsByUser.get(id) ?? [], clubIds: clubsByUser.get(id) ?? [] });

  const mine = profileFor(userId);

  let best: { id: string; score: number } | null = null;
  for (const candidate of candidateRows ?? []) {
    const theirs = profileFor(candidate.id);
    const score = tasteMatch(mine, theirs);
    if (score === null || score < MIN_TWIN_SCORE) continue;
    if (sharedWorkCount(mine, theirs) < MIN_SHARED_WORKS) continue;
    if (!best || score > best.score) best = { id: candidate.id, score };
  }

  await supabase
    .from("profiles")
    .update({
      taste_twin_id: best?.id ?? null,
      taste_twin_score: best?.score ?? null,
      taste_twin_at: new Date().toISOString(),
    })
    .eq("id", userId);

  return best?.id ?? null;
}
