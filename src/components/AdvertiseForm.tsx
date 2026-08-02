"use client";

import { useActionState, useState } from "react";
import { submitBannerAd, type BannerFormState } from "@/app/actions/banners";
import { ImageCropField } from "@/components/ImageCropField";
import { BANNER_SLOTS, bannerSlotInfo, type BannerSlotType } from "@/lib/bannerSlots";

const initialState: BannerFormState = {};

export function AdvertiseForm() {
  const [state, formAction, pending] = useActionState(submitBannerAd, initialState);
  const [slotType, setSlotType] = useState<BannerSlotType>("sidebar");
  const slot = bannerSlotInfo(slotType);

  if (state.ok) {
    return (
      <div className="form-message">
        Thanks! Your banner request is in for review - we&apos;ll reach out once it&apos;s approved.
      </div>
    );
  }

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}
      <div className="field">
        <label htmlFor="artist_name">Artist / band name</label>
        <input id="artist_name" name="artist_name" type="text" required />
      </div>
      <div className="field">
        <label htmlFor="link_url">Link (your music, site, or socials - optional)</label>
        <input id="link_url" name="link_url" type="url" placeholder="https://…" />
      </div>
      <div className="field">
        <label htmlFor="slot_type">Where should this banner run?</label>
        <select
          id="slot_type"
          name="slot_type"
          value={slotType}
          onChange={(e) => setSlotType(e.target.value as BannerSlotType)}
        >
          {BANNER_SLOTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label} - {s.width} × {s.height}px
            </option>
          ))}
        </select>
      </div>
      <ImageCropField
        key={slotType}
        id="image_file"
        name="image_file"
        label="Banner image"
        targetWidth={slot.width}
        targetHeight={slot.height}
        hint="Pick an image, then drag to reposition and use the slider to zoom/crop it to fit."
      />
      <div className="field">
        <label htmlFor="message">Short message (optional)</label>
        <textarea id="message" name="message" placeholder="A line about what you're promoting" />
      </div>
      <div className="form-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Submitting…" : "Submit for review"}
        </button>
      </div>
    </form>
  );
}
