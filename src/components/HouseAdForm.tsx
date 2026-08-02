"use client";

import { useActionState, useState } from "react";
import { adminUploadHouseAd, type BannerFormState } from "@/app/actions/banners";
import { ImageCropField } from "@/components/ImageCropField";
import { BANNER_SLOTS, bannerSlotInfo, type BannerSlotType } from "@/lib/bannerSlots";

const initialState: BannerFormState = {};

export function HouseAdForm() {
  const [state, formAction, pending] = useActionState(adminUploadHouseAd, initialState);
  const [formKey, setFormKey] = useState(0);
  const [lastOk, setLastOk] = useState(state.ok);
  const [slotType, setSlotType] = useState<BannerSlotType>("sidebar");
  const slot = bannerSlotInfo(slotType);

  if (state.ok !== lastOk) {
    setLastOk(state.ok);
    if (state.ok) setFormKey((k) => k + 1);
  }

  return (
    <form action={formAction} key={formKey}>
      {state.error && <div className="form-error">{state.error}</div>}
      {state.ok && <div className="form-message">Added - it&apos;s live and in the rotation now.</div>}
      <div className="field">
        <label htmlFor="house-ad-name">Name</label>
        <input id="house-ad-name" name="artist_name" type="text" required />
      </div>
      <div className="field">
        <label htmlFor="house-ad-link">Link (optional)</label>
        <input id="house-ad-link" name="link_url" type="url" placeholder="https://…" />
      </div>
      <div className="field">
        <label htmlFor="house-ad-slot-type">Where should this run?</label>
        <select
          id="house-ad-slot-type"
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
        id="house-ad-image"
        name="image_file"
        label="Image"
        targetWidth={slot.width}
        targetHeight={slot.height}
        hint="Pick an image, then drag to reposition and use the slider to zoom/crop it to fit."
      />
      <div className="field">
        <label htmlFor="house-ad-message">Caption (optional)</label>
        <input id="house-ad-message" name="message" type="text" />
      </div>
      <div className="form-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add to rotation"}
        </button>
      </div>
    </form>
  );
}
