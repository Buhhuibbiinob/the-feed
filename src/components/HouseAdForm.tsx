"use client";

import { useActionState, useState } from "react";
import { adminUploadHouseAd, type BannerFormState } from "@/app/actions/banners";

const initialState: BannerFormState = {};

export function HouseAdForm() {
  const [state, formAction, pending] = useActionState(adminUploadHouseAd, initialState);
  const [formKey, setFormKey] = useState(0);
  const [lastOk, setLastOk] = useState(state.ok);

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
        <label htmlFor="house-ad-link">Link</label>
        <input id="house-ad-link" name="link_url" type="url" placeholder="https://…" required />
      </div>
      <div className="field">
        <label htmlFor="house-ad-image">Image (300x250 works best)</label>
        <input id="house-ad-image" name="image_file" type="file" accept="image/*" required />
      </div>
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
