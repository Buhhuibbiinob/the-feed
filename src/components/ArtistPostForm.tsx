"use client";

import { useActionState, useState } from "react";
import { createArtistPost, type ArtistPostFormState } from "@/app/actions/artistPosts";
import { ARTIST_PLATFORMS, ARTIST_PLATFORM_LABELS } from "@/lib/artistPlatforms";

const initialState: ArtistPostFormState = {};

export function ArtistPostForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createArtistPost, initialState);

  if (!open) {
    return (
      <button type="button" className="comment-action" onClick={() => setOpen(true)}>
        + Share your work
      </button>
    );
  }

  return (
    <div className="avatar-picker">
      {state.error && <div className="form-error">{state.error}</div>}
      {state.ok && <div className="form-message">Posted — check it out below.</div>}
      <form action={formAction} className="comment-form">
        <input type="text" name="artist_name" placeholder="Creator / project name" maxLength={120} required />
        <select name="platform" defaultValue="spotify" className="theme-select">
          {ARTIST_PLATFORMS.map((platform) => (
            <option key={platform} value={platform}>
              {ARTIST_PLATFORM_LABELS[platform]}
            </option>
          ))}
        </select>
        <input type="url" name="link_url" placeholder="Link to your track, video, or profile" required />
        <textarea
          name="description"
          placeholder="Tell people about it — song, short film, music video you directed, etc. (optional)"
          maxLength={500}
          rows={3}
        />
        <div className="form-actions">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Posting…" : "Post"}
          </button>
          <button type="button" className="comment-action" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
