"use client";

import { useActionState } from "react";
import { uploadCustomBackground, type ProfileFormState } from "@/app/actions/profile";

const initialState: ProfileFormState = {};

export function BackgroundPicker() {
  const [state, formAction, pending] = useActionState(uploadCustomBackground, initialState);

  return (
    <form action={formAction} className="comment-form avatar-upload-form">
      <label className="theme-form-label">Custom background</label>
      <div className="field-hint">
        Upload your own photo to use as the site background. This automatically switches your theme to
        "Custom Background".
      </div>
      {state.error && <div className="form-error">{state.error}</div>}
      {state.ok && <div className="form-message">Background saved — refresh to see it everywhere.</div>}
      <input type="file" name="background_file" accept="image/*" required />
      <div className="form-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Uploading…" : "Upload background"}
        </button>
      </div>
    </form>
  );
}
