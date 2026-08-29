"use client";

import { useActionState, useState } from "react";
import { createPoll, type PollState } from "@/app/actions/polls";
import { MEDIA_LABELS, MEDIA_TYPES } from "@/lib/media";
import { MAX_POLL_QUESTION, MAX_POLL_TEXT } from "@/lib/polls";

const initialState: PollState = {};

/** Two fields and a button. Anything longer than that is a review. */
export function CreatePollForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createPoll, initialState);

  const [lastOk, setLastOk] = useState(state.ok);
  if (lastOk !== state.ok) {
    setLastOk(state.ok);
    if (state.ok) setOpen(false);
  }

  if (!open) {
    return (
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        Start a matchup
      </button>
    );
  }

  return (
    <form action={formAction} className="comment-form poll-form">
      {state.error && <div className="form-error">{state.error}</div>}

      <select name="media_type" defaultValue="music" className="theme-select">
        {MEDIA_TYPES.map((type) => (
          <option value={type} key={type}>
            {MEDIA_LABELS[type]}
          </option>
        ))}
      </select>

      <input
        type="text"
        name="question"
        placeholder="Ask something (optional) — e.g. which one's better?"
        maxLength={MAX_POLL_QUESTION}
      />

      <div className="poll-form-sides">
        <div>
          <input type="text" name="option_a" placeholder="This one" maxLength={MAX_POLL_TEXT} required />
          <input type="text" name="subtitle_a" placeholder="Artist / year (optional)" maxLength={MAX_POLL_TEXT} />
        </div>
        <span className="poll-vs" aria-hidden="true">
          vs
        </span>
        <div>
          <input type="text" name="option_b" placeholder="Or this one" maxLength={MAX_POLL_TEXT} required />
          <input type="text" name="subtitle_b" placeholder="Artist / year (optional)" maxLength={MAX_POLL_TEXT} />
        </div>
      </div>

      <div className="form-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Posting…" : "Post it"}
        </button>
        <button type="button" className="comment-action" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
