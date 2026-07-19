"use client";

import { useActionState, useState } from "react";
import {
  selectPresetAvatar,
  uploadAvatar,
  type ProfileFormState,
} from "@/app/actions/profile";
import { MAX_AVATAR_BYTES, megabytes } from "@/lib/uploads";

const PRESETS = [
  "/avatars/preset-1.svg",
  "/avatars/preset-2.svg",
  "/avatars/preset-3.svg",
  "/avatars/preset-4.svg",
  "/avatars/preset-5.svg",
  "/avatars/preset-6.svg",
];

const initialState: ProfileFormState = {};

export function AvatarPicker() {
  const [open, setOpen] = useState(false);
  const [presetState, presetAction, presetPending] = useActionState(
    selectPresetAvatar,
    initialState
  );
  const [uploadState, uploadAction, uploadPending] = useActionState(
    uploadAvatar,
    initialState
  );
  const [clientError, setClientError] = useState<string | null>(null);

  function handleUploadSubmit(e: React.FormEvent<HTMLFormElement>) {
    const input = e.currentTarget.elements.namedItem("avatar_file") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (file && file.size > MAX_AVATAR_BYTES) {
      e.preventDefault();
      setClientError(`Image must be under ${megabytes(MAX_AVATAR_BYTES)}MB.`);
      return;
    }
    setClientError(null);
  }

  if (!open) {
    return (
      <button type="button" className="comment-action" onClick={() => setOpen(true)}>
        Change avatar
      </button>
    );
  }

  return (
    <div className="avatar-picker">
      {presetState.error && <div className="form-error">{presetState.error}</div>}
      {(clientError || uploadState.error) && (
        <div className="form-error">{clientError ?? uploadState.error}</div>
      )}
      <div className="avatar-preset-grid">
        {PRESETS.map((preset) => (
          <form action={presetAction} key={preset}>
            <input type="hidden" name="preset" value={preset} />
            <button type="submit" className="avatar-preset-btn" disabled={presetPending}>
              <img src={preset} alt="" />
            </button>
          </form>
        ))}
      </div>
      <form action={uploadAction} onSubmit={handleUploadSubmit} className="comment-form avatar-upload-form">
        <input type="file" name="avatar_file" accept="image/*" required />
        <div className="field-hint">Max {megabytes(MAX_AVATAR_BYTES)}MB.</div>
        <div className="form-actions">
          <button className="btn" type="submit" disabled={uploadPending}>
            {uploadPending ? "Uploading…" : "Upload photo"}
          </button>
          <button type="button" className="comment-action" onClick={() => setOpen(false)}>
            Done
          </button>
        </div>
      </form>
    </div>
  );
}
