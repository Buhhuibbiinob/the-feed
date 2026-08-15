"use client";

import { useActionState, useEffect, useState } from "react";
import {
  uploadCustomBackground,
  updateBackgroundLayout,
  type ProfileFormState,
} from "@/app/actions/profile";
import { MAX_BACKGROUND_BYTES, megabytes } from "@/lib/uploads";
import {
  BACKGROUND_FITS,
  BACKGROUND_FIT_HINTS,
  BACKGROUND_FIT_LABELS,
  DEFAULT_BACKGROUND_FIT,
  type BackgroundFit,
} from "@/lib/background";

const initialState: ProfileFormState = {};

export function BackgroundPicker({
  currentUrl = null,
  currentFit = DEFAULT_BACKGROUND_FIT,
  currentFlipped = false,
}: {
  currentUrl?: string | null;
  currentFit?: BackgroundFit;
  currentFlipped?: boolean;
}) {
  const [uploadState, uploadAction, uploading] = useActionState(uploadCustomBackground, initialState);
  const [layoutState, layoutAction, savingLayout] = useActionState(updateBackgroundLayout, initialState);
  const [clientError, setClientError] = useState<string | null>(null);

  const [fit, setFit] = useState<BackgroundFit>(currentFit);
  const [flipped, setFlipped] = useState(currentFlipped);
  // Object URL for a file that hasn't been uploaded yet, so the preview can
  // show the actual chosen image rather than the previously saved one.
  const [pickedUrl, setPickedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!pickedUrl) return;
    return () => URL.revokeObjectURL(pickedUrl);
  }, [pickedUrl]);

  const previewUrl = pickedUrl ?? currentUrl;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BACKGROUND_BYTES) {
      setClientError(`Image must be under ${megabytes(MAX_BACKGROUND_BYTES)}MB.`);
      setPickedUrl(null);
      return;
    }
    setClientError(null);
    setPickedUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const input = e.currentTarget.elements.namedItem("background_file") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      e.preventDefault();
      setClientError("Choose an image file.");
      return;
    }
    if (file.size > MAX_BACKGROUND_BYTES) {
      e.preventDefault();
      setClientError(`Image must be under ${megabytes(MAX_BACKGROUND_BYTES)}MB.`);
      return;
    }
    setClientError(null);
  }

  // The preview mirrors what layout.tsx will render: same fit, same flip.
  // Flip is a transform on an inner layer rather than on the container, so
  // the mock page furniture on top of it doesn't get mirrored too.
  const layerStyle: React.CSSProperties = previewUrl
    ? {
        backgroundImage: `url("${previewUrl}")`,
        backgroundPosition: fit === "tile" ? "top left" : "center",
        backgroundSize: fit === "tile" ? "auto" : fit,
        backgroundRepeat: fit === "tile" ? "repeat" : "no-repeat",
        transform: flipped ? "scaleX(-1)" : undefined,
      }
    : {};

  return (
    <div className="bg-picker">
      <label className="theme-form-label">Custom background</label>
      <div className="field-hint">
        Upload your own photo to use as the site background (max {megabytes(MAX_BACKGROUND_BYTES)}MB).
        This switches your theme to &quot;Custom Background&quot;.
      </div>

      {/* Live preview. The inner frame is a miniature of the page so the
          choice can be judged against something page-shaped rather than
          against a bare swatch. */}
      <div className="bg-preview" aria-label="Background preview">
        {previewUrl ? (
          <>
            <span className="bg-preview-layer" style={layerStyle} />
            <span className="bg-preview-wrap">
              <span className="bg-preview-bar" />
              <span className="bg-preview-line" />
              <span className="bg-preview-line short" />
            </span>
          </>
        ) : (
          <span className="bg-preview-empty">Choose an image to preview it here</span>
        )}
      </div>

      <div className="field">
        <span className="field-hint" id="bg-fit-label">
          How it fills the page
        </span>
        <div className="bg-fit-row" role="group" aria-labelledby="bg-fit-label">
          {BACKGROUND_FITS.map((option) => (
            <button
              key={option}
              type="button"
              className={`feed-chip ${fit === option ? "active" : ""}`}
              aria-pressed={fit === option}
              onClick={() => setFit(option)}
            >
              {BACKGROUND_FIT_LABELS[option]}
            </button>
          ))}
        </div>
        <div className="field-hint">{BACKGROUND_FIT_HINTS[fit]}</div>
      </div>

      <div className="field">
        <label className="bg-flip-toggle">
          <input type="checkbox" checked={flipped} onChange={(e) => setFlipped(e.target.checked)} />
          Mirror horizontally
        </label>
      </div>

      <form action={uploadAction} onSubmit={handleSubmit} className="comment-form avatar-upload-form">
        {(clientError || uploadState.error) && (
          <div className="form-error">{clientError ?? uploadState.error}</div>
        )}
        {uploadState.ok && <div className="form-message">Background saved.</div>}
        <input type="hidden" name="background_fit" value={fit} />
        {flipped && <input type="hidden" name="background_flipped" value="on" />}
        <input type="file" name="background_file" accept="image/*" onChange={handleFile} required />
        <div className="form-actions">
          <button className="btn" type="submit" disabled={uploading}>
            {uploading ? "Uploading…" : "Upload background"}
          </button>
        </div>
      </form>

      {/* Changing fill or mirror on an image that's already up shouldn't
          mean uploading it again. */}
      {currentUrl && (
        <form action={layoutAction} className="comment-form">
          {layoutState.error && <div className="form-error">{layoutState.error}</div>}
          {layoutState.ok && <div className="form-message">Background layout saved.</div>}
          <input type="hidden" name="background_fit" value={fit} />
          {flipped && <input type="hidden" name="background_flipped" value="on" />}
          <div className="form-actions">
            <button className="btn btn-ghost" type="submit" disabled={savingLayout}>
              {savingLayout ? "Saving…" : "Save these settings for my current image"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
