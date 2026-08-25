"use client";

import { useActionState, useState } from "react";
import { setBlurbs, type PageConfigState } from "@/app/actions/pageConfig";

const initialState: PageConfigState = {};

export function BlurbsEditor({ next, free }: { next: string | null; free: string | null }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(setBlurbs, initialState);

  const [lastOk, setLastOk] = useState(state.ok);
  if (lastOk !== state.ok) {
    setLastOk(state.ok);
    if (state.ok) setOpen(false);
  }

  if (!open) {
    return (
      <button type="button" className="comment-action" onClick={() => setOpen(true)}>
        Edit blurbs
      </button>
    );
  }

  return (
    <div className="avatar-picker">
      {state.error && <div className="form-error">{state.error}</div>}
      <form action={formAction} className="comment-form">
        <label className="field-hint">What I&apos;d like to review next</label>
        <textarea
          name="blurb_next"
          defaultValue={next ?? ""}
          maxLength={300}
          placeholder="The album you keep meaning to sit down with"
        />
        <label className="field-hint">Anything else</label>
        <textarea name="blurb_free" defaultValue={free ?? ""} maxLength={300} placeholder="Anything" />
        <div className="form-actions">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save blurbs"}
          </button>
          <button type="button" className="comment-action" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
