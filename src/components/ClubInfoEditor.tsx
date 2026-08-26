"use client";

import { useActionState, useState } from "react";
import { updateClubInfo, type ModuleFormState } from "@/app/actions/pageModules";

const initialState: ModuleFormState = {};

/** The club owner's wiki-style write-up of the artist, show or film. */
export function ClubInfoEditor({ clubId, body }: { clubId: string; body: string | null }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateClubInfo, initialState);

  const [lastOk, setLastOk] = useState(state.ok);
  if (lastOk !== state.ok) {
    setLastOk(state.ok);
    if (state.ok) setOpen(false);
  }

  if (!open) {
    return (
      <button type="button" className="comment-action" onClick={() => setOpen(true)}>
        {body ? "Edit the story" : "Write the story"}
      </button>
    );
  }

  return (
    <div className="avatar-picker">
      {state.error && <div className="form-error">{state.error}</div>}
      <form action={formAction} className="comment-form">
        <input type="hidden" name="club_id" value={clubId} />
        <textarea
          name="info_body"
          defaultValue={body ?? ""}
          maxLength={4000}
          rows={10}
          placeholder="Who they are, why they matter, where to start."
        />
        <div className="form-actions">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
          <button type="button" className="comment-action" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
