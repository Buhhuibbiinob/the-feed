"use client";

import { useActionState, useState } from "react";
import { uploadCustomBackground, type ProfileFormState } from "@/app/actions/profile";
import { MAX_BACKGROUND_BYTES, megabytes } from "@/lib/uploads";

const initialState: ProfileFormState = {};

export function BackgroundPicker() {
  const [state, formAction, pending] = useActionState(uploadCustomBackground, initialState);
  const [clientError, setClientError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const input = e.currentTarget.elements.namedItem("background_file") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (file && file.size > MAX_BACKGROUND_BYTES) {
      e.preventDefault();
      setClientError(`Image must be under ${megabytes(MAX_BACKGROUND_BYTES)}MB.`);
      return;
    }
    setClientError(null);
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="comment-form avatar-upload-form">
      <label className="theme-form-label">Custom background</label>
      <div className="field-hint">
        Upload your own photo to use as the site background (max {megabytes(MAX_BACKGROUND_BYTES)}MB).
        This automatically switches your theme to "Custom Background".
      </div>
      {(clientError || state.error) && <div className="form-error">{clientError ?? state.error}</div>}
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
