"use client";

import { useActionState, useState } from "react";
import { addToQueue, type QueueState } from "@/app/actions/queue";
import { MediaSearchField } from "@/components/MediaSearchField";
import { MEDIA_LABELS } from "@/lib/media";

const initialState: QueueState = {};

/**
 * Adding something to the list.
 *
 * The search is the same one the profile pickers use, so a title and its
 * artwork arrive together and the list has pictures in it without anybody
 * hunting for an image URL. Typing a title by hand still works, because
 * plenty of what people mean to watch isn't findable that way - a film
 * somebody mentioned, a record that isn't on YouTube.
 */
export function QueueAddForm() {
  const [state, formAction, pending] = useActionState(addToQueue, initialState);
  const [mediaType, setMediaType] = useState("movie_tv");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  // Cleared by comparing against the previous result during render rather
  // than from an effect, the same way the profile pickers do it: an
  // effect would paint the just-added entry into the still-full form
  // first and empty it on a second pass.
  const [lastOk, setLastOk] = useState(state.ok);
  if (lastOk !== state.ok) {
    setLastOk(state.ok);
    if (state.ok) {
      setTitle("");
      setSubtitle("");
      setImageUrl("");
    }
  }

  return (
    <form action={formAction} className="comment-form queue-add">
      {state.error && <div className="form-error">{state.error}</div>}

      <div className="field">
        <label htmlFor="queue-type">Category</label>
        <select
          id="queue-type"
          name="media_type"
          value={mediaType}
          onChange={(e) => setMediaType(e.target.value)}
        >
          <option value="music">{MEDIA_LABELS.music}</option>
          <option value="movie_tv">{MEDIA_LABELS.movie_tv}</option>
          <option value="photography">{MEDIA_LABELS.photography}</option>
        </select>
      </div>

      {mediaType !== "photography" && (
        <MediaSearchField
          placeholder="Search for it, or just type the name below…"
          onPick={(video) => {
            setTitle(video.title);
            setSubtitle(video.channelTitle);
            setImageUrl(video.thumbnailUrl ?? "");
          }}
        />
      )}

      <div className="field">
        <label htmlFor="queue-title">Name</label>
        <input
          id="queue-title"
          name="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="queue-subtitle">Artist or director (optional)</label>
        <input
          id="queue-subtitle"
          name="subtitle"
          type="text"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
        />
      </div>

      <input type="hidden" name="image_url" value={imageUrl} />

      <div className="form-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add to the list"}
        </button>
      </div>
    </form>
  );
}
