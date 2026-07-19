"use client";

import { useActionState, useState } from "react";
import { uploadClubBanner, uploadClubAvatar, type ClubImageFormState } from "@/app/actions/clubs";
import { MAX_CLUB_IMAGE_BYTES, megabytes } from "@/lib/uploads";

const initialState: ClubImageFormState = {};

function useSizeGuard(fieldName: string) {
  const [clientError, setClientError] = useState<string | null>(null);
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const input = e.currentTarget.elements.namedItem(fieldName) as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (file && file.size > MAX_CLUB_IMAGE_BYTES) {
      e.preventDefault();
      setClientError(`Image must be under ${megabytes(MAX_CLUB_IMAGE_BYTES)}MB.`);
      return;
    }
    setClientError(null);
  }
  return { clientError, handleSubmit };
}

export function ClubImageForms({ clubId }: { clubId: string }) {
  const [bannerState, bannerAction, bannerPending] = useActionState(uploadClubBanner, initialState);
  const [avatarState, avatarAction, avatarPending] = useActionState(uploadClubAvatar, initialState);
  const banner = useSizeGuard("banner_file");
  const avatar = useSizeGuard("avatar_file");

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <form action={bannerAction} onSubmit={banner.handleSubmit} className="comment-form avatar-upload-form">
        <input type="hidden" name="club_id" value={clubId} />
        <label className="theme-form-label">Club banner</label>
        {(banner.clientError || bannerState.error) && (
          <div className="form-error">{banner.clientError ?? bannerState.error}</div>
        )}
        {bannerState.ok && <div className="form-message">Banner saved.</div>}
        <input type="file" name="banner_file" accept="image/*" required />
        <div className="field-hint">Max {megabytes(MAX_CLUB_IMAGE_BYTES)}MB.</div>
        <div className="form-actions">
          <button className="btn" type="submit" disabled={bannerPending}>
            {bannerPending ? "Uploading…" : "Upload banner"}
          </button>
        </div>
      </form>

      <form action={avatarAction} onSubmit={avatar.handleSubmit} className="comment-form avatar-upload-form">
        <input type="hidden" name="club_id" value={clubId} />
        <label className="theme-form-label">Club picture</label>
        {(avatar.clientError || avatarState.error) && (
          <div className="form-error">{avatar.clientError ?? avatarState.error}</div>
        )}
        {avatarState.ok && <div className="form-message">Picture saved.</div>}
        <input type="file" name="avatar_file" accept="image/*" required />
        <div className="field-hint">Max {megabytes(MAX_CLUB_IMAGE_BYTES)}MB.</div>
        <div className="form-actions">
          <button className="btn" type="submit" disabled={avatarPending}>
            {avatarPending ? "Uploading…" : "Upload picture"}
          </button>
        </div>
      </form>
    </div>
  );
}
