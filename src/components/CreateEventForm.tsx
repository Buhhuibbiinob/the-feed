"use client";

import { useActionState, useEffect, useState } from "react";
import { createEvent, type EventFormState } from "@/app/actions/events";
import { MAX_EVENT_FLYER_BYTES, megabytes } from "@/lib/uploads";

const initialState: EventFormState = {};

export function CreateEventForm({ clubId }: { clubId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createEvent, initialState);
  const [clientError, setClientError] = useState<string | null>(null);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const input = e.currentTarget.elements.namedItem("flyer_file") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (file && file.size > MAX_EVENT_FLYER_BYTES) {
      e.preventDefault();
      setClientError(`Flyer must be under ${megabytes(MAX_EVENT_FLYER_BYTES)}MB.`);
      return;
    }
    setClientError(null);
  }

  if (!open) {
    return (
      <button type="button" className="comment-action" onClick={() => setOpen(true)}>
        + New event
      </button>
    );
  }

  return (
    <div className="avatar-picker">
      {(clientError || state.error) && <div className="form-error">{clientError ?? state.error}</div>}
      <form action={formAction} onSubmit={handleSubmit} className="comment-form">
        <input type="hidden" name="club_id" value={clubId} />
        <input type="text" name="title" placeholder="Event title" maxLength={120} required />
        <input type="datetime-local" name="event_time" required />
        <textarea name="description" placeholder="Details (optional)" maxLength={1000} rows={3} />
        <label className="theme-form-label">Flyer (optional)</label>
        <input type="file" name="flyer_file" accept="image/*" />
        <div className="field-hint">Max {megabytes(MAX_EVENT_FLYER_BYTES)}MB.</div>
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
