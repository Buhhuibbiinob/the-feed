import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaType } from "@/lib/media";

export const MAX_POLL_TEXT = 90;
export const MAX_POLL_QUESTION = 120;

export type Poll = {
  id: string;
  createdBy: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
  mediaType: MediaType;
  question: string | null;
  optionA: string;
  optionB: string;
  subtitleA: string | null;
  subtitleB: string | null;
  createdAt: string;
  votesA: number;
  votesB: number;
  /** "a", "b", or null when the viewer has not voted. */
  myVote: "a" | "b" | null;
};

type PollRow = {
  id: string;
  created_by: string;
  media_type: MediaType;
  question: string | null;
  option_a: string;
  option_b: string;
  subtitle_a: string | null;
  subtitle_b: string | null;
  created_at: string;
};

type VoteRow = { poll_id: string; user_id: string; choice: "a" | "b" };
type ProfileRow = { id: string; username: string; avatar_url: string | null };

/**
 * The polls for a page, with their tallies and the viewer's own vote.
 *
 * Three queries for the whole page rather than three per poll: the polls,
 * every vote on them, and the authors. Counting in JS rather than with a
 * grouped query keeps it to one round trip and means the viewer's own
 * vote falls out of the same rows.
 */
export async function loadPolls(
  supabase: SupabaseClient,
  viewerId: string | null,
  limit = 30
): Promise<Poll[]> {
  const { data: pollRows } = await supabase
    .from("polls")
    .select("id, created_by, media_type, question, option_a, option_b, subtitle_a, subtitle_b, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<PollRow[]>();

  const polls = pollRows ?? [];
  if (polls.length === 0) return [];

  const ids = polls.map((p) => p.id);
  const authorIds = [...new Set(polls.map((p) => p.created_by))];

  const [{ data: voteRows }, { data: profileRows }] = await Promise.all([
    supabase.from("poll_votes").select("poll_id, user_id, choice").in("poll_id", ids).returns<VoteRow[]>(),
    supabase.from("profiles").select("id, username, avatar_url").in("id", authorIds).returns<ProfileRow[]>(),
  ]);

  const tally = new Map<string, { a: number; b: number }>();
  const mine = new Map<string, "a" | "b">();
  for (const vote of voteRows ?? []) {
    const counts = tally.get(vote.poll_id) ?? { a: 0, b: 0 };
    counts[vote.choice] += 1;
    tally.set(vote.poll_id, counts);
    if (viewerId && vote.user_id === viewerId) mine.set(vote.poll_id, vote.choice);
  }

  const profiles = new Map((profileRows ?? []).map((p) => [p.id, p]));

  return polls.map((poll) => {
    const counts = tally.get(poll.id) ?? { a: 0, b: 0 };
    const author = profiles.get(poll.created_by);
    return {
      id: poll.id,
      createdBy: poll.created_by,
      authorUsername: author?.username ?? "someone",
      authorAvatarUrl: author?.avatar_url ?? null,
      mediaType: poll.media_type,
      question: poll.question,
      optionA: poll.option_a,
      optionB: poll.option_b,
      subtitleA: poll.subtitle_a,
      subtitleB: poll.subtitle_b,
      createdAt: poll.created_at,
      votesA: counts.a,
      votesB: counts.b,
      myVote: mine.get(poll.id) ?? null,
    };
  });
}

/**
 * The share of the vote for one side, as a whole percent.
 *
 * Rounded so the two sides always sum to 100. Rounding each side on its
 * own gives 33% and 67% for one vote against two, but also 50/50 for a
 * 1-1 split shown as 33/33 elsewhere - the bar and the number have to
 * agree or the poll looks broken.
 */
export function sharePercent(votesA: number, votesB: number): [number, number] {
  const total = votesA + votesB;
  if (total === 0) return [0, 0];
  const a = Math.round((votesA / total) * 100);
  return [a, 100 - a];
}
