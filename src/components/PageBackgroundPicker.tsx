"use client";

import { useActionState, useState } from "react";
import { uploadPageBackground, type PageConfigState } from "@/app/actions/pageConfig";
import {
  PAGE_BACKGROUND_FITS,
  PAGE_BACKGROUND_FIT_LABELS,
  type PageBackground,
  type PageBackgroundFit,
  type SurfaceKind,
} from "@/lib/pageConfig";
import { MAX_BACKGROUND_BYTES, megabytes } from "@/lib/uploads";

const initialState: PageConfigState = {};

const FIT_HINTS: Record<PageBackgroundFit, string> = {
  cover: "Crops to fill the page. Best for photos.",
  tile: "Repeats at its own size, like an old desktop wallpaper.",
  contain: "Shows the whole image, with space around it.",
};

/**
 * A photo behind your page.
 *
 * The config has carried `background.kind = "image"` from the start and
 * nothing ever offered a file picker for it, so the only route to the
 * single most-wanted customization was to write a CSS rule containing a
 * URL. This is that feature, as a file picker.
 *
 * Posted on its own rather than folded into the big config save, because
 * a file upload and a JSON blob are different shapes of request and
 * pairing them means a 3MB photo has to survive every retry of the
 * settings post.
 */
export function PageBackgroundPicker({
  surface,
  ownerId,
  background,
}: {
  surface: SurfaceKind;
  ownerId: string;
  background: PageBackground;
}) {
  const [state, formAction, pending] = useActionState(uploadPageBackground, initialState);
  const [fit, setFit] = useState<PageBackgroundFit>(background.fit ?? "cover");
  const [preview, setPreview] = useState<string | null>(null);

  const current = background.kind === "image" ? background.value : null;

  return (
    <div className="bg-picker">
      {state.error && <div className="form-error">{state.error}</div>}

      {(preview ?? current) && (
        <div
          className="bg-preview"
          style={{
            backgroundImage: `url("${(preview ?? current)!.replace(/["\\]/g, "")}")`,
            backgroundSize: fit === "tile" ? "auto" : fit,
            backgroundRepeat: fit === "tile" ? "repeat" : "no-repeat",
          }}
        />
      )}

      <div className="pattern-grid">
        {PAGE_BACKGROUND_FITS.map((option) => (
          <button
            type="button"
            key={option}
            className={`pattern-chip${fit === option ? " active" : ""}`}
            onClick={() => setFit(option)}
            title={FIT_HINTS[option]}
          >
            {PAGE_BACKGROUND_FIT_LABELS[option]}
          </button>
        ))}
      </div>
      <div className="field-hint">{FIT_HINTS[fit]}</div>

      <form action={formAction} className="comment-form">
        <input type="hidden" name="surface" value={surface} />
        <input type="hidden" name="owner_id" value={ownerId} />
        <input type="hidden" name="fit" value={fit} />
        <input
          type="file"
          name="background_file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Shown from the local file so the framing is visible before
            // three megabytes go over the network.
            setPreview(file ? URL.createObjectURL(file) : null);
          }}
        />
        <div className="form-actions">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Uploading…" : current ? "Replace photo" : "Use a photo"}
          </button>
        </div>
        <div className="field-hint">
          Max {megabytes(MAX_BACKGROUND_BYTES)}MB. Turn up See-through below so it shows between
          your panels.
        </div>
      </form>
    </div>
  );
}
