"use client";

import { useActionState } from "react";
import { updateCustomPage, type PageFormState } from "@/app/actions/pages";
import type { SitePage } from "@/lib/pages";

const initialState: PageFormState = {};

export function EditPageForm({ page }: { page: SitePage }) {
  const [state, formAction, pending] = useActionState(updateCustomPage, initialState);

  return (
    <form action={formAction} className="comment-form">
      <input type="hidden" name="id" value={page.id} />
      {state.error && <div className="form-error">{state.error}</div>}
      {state.ok && <div className="form-message">Saved.</div>}

      <label className="theme-form-label">Title</label>
      <input name="label" defaultValue={page.label} required />

      <label className="theme-form-label">Content</label>
      <textarea name="content" defaultValue={page.content ?? ""} rows={8} />

      <div className="form-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
