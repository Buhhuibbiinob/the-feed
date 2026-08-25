import type { SupabaseClient } from "@supabase/supabase-js";
import { tallyReviewReactions } from "@/lib/reactions";

export type ReactionsByPost = Map<string, { counts: { emoji: string; count: number }[]; mine: string | null }>;

type Row = { post_id: string; user_id: string; emoji: string };

/**
 * Reaction tags for a batch of reviews, in the shape PostCard wants.
 *
 * Every page that renders a PostCard calls this rather than each one
 * rolling its own query - when only the feed had the data, reacting from
 * search or a club worked but showed no tally, which reads as the button
 * being broken.
 */
export async function fetchPostReactions(
  supabase: SupabaseClient,
  postIds: string[],
  userId: string | null
): Promise<ReactionsByPost> {
  const byPost: ReactionsByPost = new Map();
  if (postIds.length === 0) return byPost;

  const { data } = await supabase
    .from("post_reactions")
    .select("post_id, user_id, emoji")
    .in("post_id", postIds)
    .returns<Row[]>();

  const grouped = new Map<string, Row[]>();
  for (const row of data ?? []) {
    const list = grouped.get(row.post_id) ?? [];
    list.push(row);
    grouped.set(row.post_id, list);
  }

  for (const postId of postIds) {
    const rows = grouped.get(postId) ?? [];
    byPost.set(postId, {
      counts: tallyReviewReactions(rows.map((r) => r.emoji)),
      mine: userId ? rows.find((r) => r.user_id === userId)?.emoji ?? null : null,
    });
  }

  return byPost;
}

export const EMPTY_REACTIONS = { counts: [] as { emoji: string; count: number }[], mine: null };
