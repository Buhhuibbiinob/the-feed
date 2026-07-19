"use client";

import { useActionState, useState } from "react";
import { updateBio, uploadBanner, type ProfileFormState } from "@/app/actions/profile";
import { MAX_BANNER_BYTES, megabytes } from "@/lib/uploads";

const initialState: ProfileFormState = {};

export function ProfileCustomize({ bio }: { bio: string | null }) {
  const [open, setOpen] = useState(false);
  const [bioState, bioAction, bioPending] = useActionState(updateBio, initialState);
  const [bannerState, bannerAction, bannerPending] = useActionState(uploadBanner, initialState);
  const [clientError, setClientError] = useState<string | null>(null);

  function handleBannerSubmit(e: React.FormEvent<HTMLFormElement>) {
    const input = e.currentTarget.elements.namedItem("banner_file") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (file && file.size > MAX_BANNER_BYTES) {
      e.preventDefault();
      setClientError(`Image must be under ${megabytes(MAX_BANNER_BYTES)}MB.`);
      return;
    }
    setClientError(null);
  }

  if (!open) {
    return (
      <button type="button" className="comment-action" onClick={() => setOpen(true)}>
        Edit bio & banner
      </button>
    );
  }

  return (
    <div className="avatar-picker">
      {bioState.error && <div className="form-error">{bioState.error}</div>}
      {(clientError || bannerState.error) && (
        <div className="form-error">{clientError ?? bannerState.error}</div>
      )}

      <form action={bioAction} className="comment-form">
        <textarea name="bio" defaultValue={bio ?? ""} maxLength={500} placeholder="Write a short bio…" />
        <div className="form-actions">
          <button className="btn" type="submit" disabled={bioPending}>
            {bioPending ? "Saving…" : "Save bio"}
          </button>
        </div>
      </form>

      <form action={bannerAction} onSubmit={handleBannerSubmit} className="comment-form avatar-upload-form">
        <input type="file" name="banner_file" accept="image/*" required />
        <div className="field-hint">Max {megabytes(MAX_BANNER_BYTES)}MB.</div>
        <div className="form-actions">
          <button className="btn" type="submit" disabled={bannerPending}>
            {bannerPending ? "Uploading…" : "Upload banner"}
          </button>
          <button type="button" className="comment-action" onClick={() => setOpen(false)}>
            Done
          </button>
        </div>
      </form>
    </div>
  );
}
