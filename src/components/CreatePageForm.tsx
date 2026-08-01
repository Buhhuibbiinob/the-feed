"use client";

import { useActionState } from "react";
import { createCustomPage, type PageFormState } from "@/app/actions/pages";

const initialState: PageFormState = {};

export function CreatePageForm() {
  const [state, formAction, pending] = useActionState(createCustomPage, initialState);

  return (
    <form action={formAction} className="comment-form">
      {state.error && <div className="form-error">{state.error}</div>}

      <label className="theme-form-label">Title</label>
      <input name="label" placeholder="About Us" required />

      <label className="theme-form-label">URL slug</label>
      <input name="slug" placeholder="about-us" required />

      <label className="theme-form-label">Content</label>
      <textarea name="content" placeholder="What should this page say?" rows={6} />

      <div className="form-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Creating..." : "Create Page"}
        </button>
      </div>
    </form>
  );
}
