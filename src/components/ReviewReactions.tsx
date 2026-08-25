"use client";

import { reactToPost } from "@/app/actions/profileActivity";
import { REVIEW_REACTIONS, reviewReactionLabel } from "@/lib/reactions";

export type ReviewReactionState = {
  counts: { emoji: string; count: number }[];
  mine: string | null;
};

/**
 * Reaction tags under a review, alongside the stars rather than instead of
 * them. A star says how good it was; these say what it did to you.
 *
 * Signed-out readers see the tallies and no buttons - the whole appeal is
 * that reacting is faster than writing, and a button that bounces you to a
 * sign-in page is not faster than anything.
 */
export function ReviewReactions({
  postId,
  state,
  canReact,
}: {
  postId: string;
  state: ReviewReactionState;
  canReact: boolean;
}) {
  if (!canReact) {
    if (state.counts.length === 0) return null;
    return (
      <div className="review-reactions readonly">
        {state.counts.map((r) => (
          <span className="pick-reaction-tally" key={r.emoji}>
            {r.emoji} {r.count}
          </span>
        ))}
      </div>
    );
  }

  const countFor = (emoji: string) => state.counts.find((c) => c.emoji === emoji)?.count ?? 0;

  return (
    <div className="review-reactions">
      {REVIEW_REACTIONS.map((reaction) => {
        const count = countFor(reaction.emoji);
        const isMine = state.mine === reaction.emoji;
        return (
          <form action={reactToPost} key={reaction.emoji}>
            <input type="hidden" name="post_id" value={postId} />
            <input type="hidden" name="emoji" value={reaction.emoji} />
            <button
              type="submit"
              className={`pick-reaction${isMine ? " mine" : ""}`}
              title={
                isMine
                  ? `Remove "${reviewReactionLabel(reaction.emoji)}"`
                  : reviewReactionLabel(reaction.emoji)
              }
              aria-pressed={isMine}
            >
              {reaction.emoji}
              {count > 0 && <span className="pick-reaction-count">{count}</span>}
            </button>
          </form>
        );
      })}
    </div>
  );
}
