"use client";

import { useActionState, useEffect, useState } from "react";
import { createClubPost, type PostFormState } from "@/app/actions/posts";

const initialState: PostFormState = {};

export function ClubPostForm({ clubId }: { clubId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createClubPost, initialState);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <button type="button" className="comment-action" onClick={() => setOpen(true)}>
        + Add a post
      </button>
    );
  }

  return (
    <div className="avatar-picker">
      {state.error && <div className="form-error">{state.error}</div>}
      <form action={formAction} className="comment-form">
        <input type="hidden" name="club_id" value={clubId} />
        <input type="text" name="title" placeholder="Title" maxLength={200} required />
        <input
          type="url"
          name="youtube_url"
          placeholder="YouTube link (optional — music video, clip, etc.)"
        />
        <textarea name="body" placeholder="Say something about it…" maxLength={2000} rows={3} required />
        <select name="rating" defaultValue="" className="theme-select">
          <option value="">No rating</option>
          <option value="5">★★★★★</option>
          <option value="4">★★★★☆</option>
          <option value="3">★★★☆☆</option>
          <option value="2">★★☆☆☆</option>
          <option value="1">★☆☆☆☆</option>
        </select>
        <div className="form-actions">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Posting…" : "Post to club"}
          </button>
          <button type="button" className="comment-action" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
