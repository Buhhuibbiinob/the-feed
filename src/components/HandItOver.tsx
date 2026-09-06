"use client";

import { useActionState, useState } from "react";
import { handRecord, type HandoffState } from "@/app/actions/handoffs";
import { MAX_NOTE, type HandCandidate } from "@/lib/handoffs";

const initialState: HandoffState = {};

/**
 * "Hand it to someone" on a review.
 *
 * Deliberately one person at a time. A share button that posts to
 * everybody is broadcasting, and broadcasting is what the feed already
 * is; the thing this site had no way to do was tell ONE person that a
 * particular record was for them.
 *
 * The people are loaded with the page rather than searched for. On a
 * site this size the whole membership fits in a list, and a search box
 * over thirteen names is a search box that makes you type to find
 * somebody you can already see.
 */
export function HandItOver({
  postId,
  candidates,
}: {
  postId: string;
  candidates: HandCandidate[];
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(handRecord, initialState);

  // Closed by comparing against the previous result during render rather
  // than from an effect, the same way the profile pickers do it.
  const [lastOk, setLastOk] = useState(state.ok);
  if (lastOk !== state.ok) {
    setLastOk(state.ok);
    if (state.ok) {
      setOpen(false);
      setPicked(null);
    }
  }

  if (candidates.length === 0) return null;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}>
        Hand it to someone
      </button>
    );
  }

  return (
    <form action={formAction} className="handover">
      <input type="hidden" name="post_id" value={postId} />
      <input type="hidden" name="to_user_id" value={picked ?? ""} />

      <div className="handover-people">
        {candidates.map((person) => (
          <button
            key={person.id}
            type="button"
            className={`handover-person${picked === person.id ? " picked" : ""}`}
            aria-pressed={picked === person.id}
            onClick={() => setPicked(picked === person.id ? null : person.id)}
          >
            {person.avatarUrl ? (
              <img src={person.avatarUrl} alt="" />
            ) : (
              <span className="handover-blank" aria-hidden="true" />
            )}
            {person.username}
          </button>
        ))}
      </div>

      {/* Optional, and the whole point. The placeholder says what a good
          one sounds like, because "add a note" produces notes that say
          "check this out". */}
      <input
        type="text"
        name="note"
        maxLength={MAX_NOTE}
        placeholder="Why them? — “the one I kept going on about”"
        className="handover-note"
      />

      {state.error && <div className="form-error">{state.error}</div>}

      <div className="handover-actions">
        <button type="submit" className="btn" disabled={pending || !picked}>
          {pending ? "Handing it over…" : "Hand it over"}
        </button>
        <button type="button" className="handover-cancel" onClick={() => setOpen(false)}>
          Never mind
        </button>
      </div>
    </form>
  );
}
