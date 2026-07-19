"use client";

import { useActionState, useEffect, useState } from "react";
import { createEvent, type EventFormState } from "@/app/actions/events";

const initialState: EventFormState = {};

export function CreateEventForm({ clubId }: { clubId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createEvent, initialState);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);

  if (!open) {
    return (
      <button type="button" className="comment-action" onClick={() => setOpen(true)}>
        + New event
      </button>
    );
  }

  return (
    <div className="avatar-picker">
      {state.error && <div className="form-error">{state.error}</div>}
      <form action={formAction} className="comment-form">
        <input type="hidden" name="club_id" value={clubId} />
        <input type="text" name="title" placeholder="Event title" maxLength={120} required />
        <input type="datetime-local" name="event_time" required />
        <input type="text" name="location" placeholder="Location or link (optional)" maxLength={200} />
        <textarea name="description" placeholder="Details (optional)" maxLength={1000} rows={3} />
        <div className="form-actions">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create event"}
          </button>
          <button type="button" className="comment-action" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
