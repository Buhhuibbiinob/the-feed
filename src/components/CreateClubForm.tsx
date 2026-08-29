"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createClub, type CreateClubFormState } from "@/app/actions/clubs";
import { MEDIA_LABELS, MEDIA_TYPES } from "@/lib/media";

const initialState: CreateClubFormState = {};

export function CreateClubForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createClub, initialState);

  if (!open) {
    return (
      <button type="button" className="comment-action" onClick={() => setOpen(true)}>
        + Start a club
      </button>
    );
  }

  if (state.ok && state.clubId) {
    return (
      <div className="form-message">
        Submitted for review - you can manage it once it&apos;s approved.{" "}
        <Link href={`/clubs/${state.clubId}`}>View your club</Link>
      </div>
    );
  }

  return (
    <div className="avatar-picker">
      {state.error && <div className="form-error">{state.error}</div>}
      <form action={formAction} className="comment-form">
        <input
          type="text"
          name="name"
          placeholder="Club name (artist, film, show, or subject)"
          maxLength={120}
          required
        />
        <select name="media_type" defaultValue="music" className="theme-select">
          {MEDIA_TYPES.map((type) => (
            <option value={type} key={type}>
              {MEDIA_LABELS[type]}
            </option>
          ))}
        </select>
        <div className="field-hint">
          New clubs are reviewed by an admin before they&apos;re listed publicly. Once approved,
          you&apos;ll be able to manage its banner and picture.
        </div>
        <div className="form-actions">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Submitting…" : "Submit for review"}
          </button>
          <button type="button" className="comment-action" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
