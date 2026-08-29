import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReactionCount } from "@/components/PostReactions";

type ReactionRow = { post_id: string; user_id: string; emoji: string };

export type ReactionIndex = {
  countsFor: (postId: string) => ReactionCount[];
  mineFor: (postId: string) => string | null;
};

/**
 * Every reaction on a set of reviews, grouped for rendering.
 *
 * One query for the whole page rather than one per card, and the same
 * shape whether the caller has one review or thirty - which is what
 * stops the feed from issuing a query per post as it grows.
 *
 * Counts come back most-used first so the row reads as a summary, with
 * ties broken by the emoji itself so the order is stable between renders
 * rather than shuffling as the map is walked.
 */
export async function loadReactions(
  supabase: SupabaseClient,
  postIds: string[],
  viewerId: string | null
): Promise<ReactionIndex> {
  const empty: ReactionIndex = { countsFor: () => [], mineFor: () => null };
  if (postIds.length === 0) return empty;

  const { data } = await supabase
    .from("post_reactions")
    .select("post_id, user_id, emoji")
    .in("post_id", postIds)
    .returns<ReactionRow[]>();

  const byPost = new Map<string, Map<string, number>>();
  const mine = new Map<string, string>();

  for (const row of data ?? []) {
    const counts = byPost.get(row.post_id) ?? new Map<string, number>();
    counts.set(row.emoji, (counts.get(row.emoji) ?? 0) + 1);
    byPost.set(row.post_id, counts);
    if (viewerId && row.user_id === viewerId) mine.set(row.post_id, row.emoji);
  }

  const sorted = new Map<string, ReactionCount[]>();
  for (const [postId, counts] of byPost) {
    sorted.set(
      postId,
      [...counts.entries()]
        .map(([emoji, count]) => ({ emoji, count }))
        .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji))
    );
  }

  return {
    countsFor: (postId) => sorted.get(postId) ?? [],
    mineFor: (postId) => mine.get(postId) ?? null,
  };
}
