"use client";

import { useActionState, useState } from "react";
import { updateBio, uploadBanner, type ProfileFormState } from "@/app/actions/profile";
import { ImageCropField } from "@/components/ImageCropField";
import { MAX_BANNER_BYTES, megabytes } from "@/lib/uploads";
import { BANNER_ASPECTS, bannerAspect, type BannerAspectId } from "@/lib/bannerShape";
import { PROFILE_FONTS, fontStack, type ProfileFontId } from "@/lib/profileSkin";
import { renderRichBio, BIO_FORMATTING_HINT } from "@/lib/richBio";

const initialState: ProfileFormState = {};

export function ProfileCustomize({
  bio,
  bioFont,
  bioColor,
  bannerAspectId,
  ownerId,
}: {
  bio: string | null;
  bioFont: string | null;
  bioColor: string | null;
  bannerAspectId: string | null;
  ownerId: string;
}) {
  const [open, setOpen] = useState(false);
  const [bioState, bioAction, bioPending] = useActionState(updateBio, initialState);
  const [bannerState, bannerAction, bannerPending] = useActionState(uploadBanner, initialState);
  const [clientError, setClientError] = useState<string | null>(null);

  const [draftBio, setDraftBio] = useState(bio ?? "");
  const [font, setFont] = useState<ProfileFontId>((bioFont as ProfileFontId | null) ?? "system");
  const [color, setColor] = useState<string | null>(bioColor);
  const [aspect, setAspect] = useState<BannerAspectId>(bannerAspect(bannerAspectId).id);

  const shape = bannerAspect(aspect);

  function handleBannerSubmit(e: React.FormEvent<HTMLFormElement>) {
    const input = e.currentTarget.elements.namedItem("banner_file") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      e.preventDefault();
      setClientError("Choose an image first.");
      return;
    }
    if (file.size > MAX_BANNER_BYTES) {
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
        <input type="hidden" name="owner_id" value={ownerId} />
        <textarea
          name="bio"
          value={draftBio}
          onChange={(e) => setDraftBio(e.target.value)}
          maxLength={500}
          placeholder="Write a short bio…"
          style={{
            fontFamily: fontStack(font) ?? undefined,
            color: color ?? undefined,
          }}
        />
        <div className="field-hint">{BIO_FORMATTING_HINT}</div>

        <div className="bio-style-row">
          <label>
            Font
            <select
              name="bio_font"
              value={font}
              onChange={(e) => setFont(e.target.value as ProfileFontId)}
            >
              {PROFILE_FONTS.map((f) => (
                <option value={f.id} key={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Colour
            <input
              type="color"
              value={color ?? "#333333"}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Bio colour"
            />
          </label>
          <input type="hidden" name="bio_color" value={color ?? ""} />
          <button
            type="button"
            className="comment-action"
            onClick={() => setColor(null)}
            disabled={color === null}
          >
            Default colour
          </button>
        </div>

        {draftBio.trim() && (
          <div
            className="profile-bio bio-preview"
            style={{ fontFamily: fontStack(font) ?? undefined, color: color ?? undefined }}
          >
            {renderRichBio(draftBio)}
          </div>
        )}

        <div className="form-actions">
          <button className="btn" type="submit" disabled={bioPending}>
            {bioPending ? "Saving…" : "Save bio"}
          </button>
        </div>
      </form>

      <form action={bannerAction} onSubmit={handleBannerSubmit} className="comment-form avatar-upload-form">
        <input type="hidden" name="owner_id" value={ownerId} />
        <div className="banner-shape-row">
          {BANNER_ASPECTS.map((option) => (
            <label key={option.id} className="banner-shape-option">
              <input
                type="radio"
                name="banner_aspect"
                value={option.id}
                checked={aspect === option.id}
                onChange={() => setAspect(option.id)}
              />
              {option.label}
            </label>
          ))}
        </div>
        {/* Keyed on the shape so switching it starts the crop over at the
            new ratio rather than re-exporting the old framing. */}
        <ImageCropField
          key={shape.id}
          id="banner-crop"
          name="banner_file"
          label="Banner"
          hint={`Max ${megabytes(MAX_BANNER_BYTES)}MB.`}
          targetWidth={shape.width}
          targetHeight={shape.height}
        />
        <div className="form-actions">
          <button className="btn" type="submit" disabled={bannerPending}>
            {bannerPending ? "Uploading…" : "Save banner"}
          </button>
          <button type="button" className="comment-action" onClick={() => setOpen(false)}>
            Done
          </button>
        </div>
      </form>
    </div>
  );
}
