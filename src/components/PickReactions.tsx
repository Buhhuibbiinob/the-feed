"use client";

import { reactToPick } from "@/app/actions/profileActivity";
import { PICK_REACTIONS, reactionLabel } from "@/lib/reactions";

export type PickReactionState = {
  favoriteId: string;
  counts: { emoji: string; count: number }[];
  mine: string | null;
};

/**
 * The reaction row under one of someone's top-list picks.
 *
 * Signed-out visitors and the pick's own owner see the tallies but no
 * buttons - there's nothing for either of them to press, and rendering
 * dead buttons is worse than rendering none.
 */
export function PickReactions({
  state,
  canReact,
}: {
  state: PickReactionState;
  canReact: boolean;
}) {
  if (!canReact) {
    if (state.counts.length === 0) return null;
    return (
      <span className="pick-reactions readonly">
        {state.counts.map((r) => (
          <span className="pick-reaction-tally" key={r.emoji}>
            {r.emoji} {r.count}
          </span>
        ))}
      </span>
    );
  }

  const countFor = (emoji: string) => state.counts.find((c) => c.emoji === emoji)?.count ?? 0;

  return (
    <span className="pick-reactions">
      {PICK_REACTIONS.map((reaction) => {
        const count = countFor(reaction.emoji);
        const isMine = state.mine === reaction.emoji;
        return (
          <form action={reactToPick} key={reaction.emoji}>
            <input type="hidden" name="favorite_id" value={state.favoriteId} />
            <input type="hidden" name="emoji" value={reaction.emoji} />
            <button
              type="submit"
              className={`pick-reaction${isMine ? " mine" : ""}`}
              title={isMine ? `Remove "${reactionLabel(reaction.emoji)}"` : reactionLabel(reaction.emoji)}
              aria-pressed={isMine}
            >
              {reaction.emoji}
              {count > 0 && <span className="pick-reaction-count">{count}</span>}
            </button>
          </form>
        );
      })}
    </span>
  );
}
