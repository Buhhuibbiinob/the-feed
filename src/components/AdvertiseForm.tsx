"use client";

import { useActionState } from "react";
import { submitBannerAd, type BannerFormState } from "@/app/actions/banners";

const initialState: BannerFormState = {};

export function AdvertiseForm() {
  const [state, formAction, pending] = useActionState(submitBannerAd, initialState);

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
        <label htmlFor="link_url">Link (your music, site, or socials)</label>
        <input id="link_url" name="link_url" type="url" placeholder="https://…" required />
      </div>
      <div className="field">
        <label htmlFor="image_file">Banner image (300x250 works best)</label>
        <input id="image_file" name="image_file" type="file" accept="image/*" />
      </div>
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
