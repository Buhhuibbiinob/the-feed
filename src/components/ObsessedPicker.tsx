"use client";

import { useActionState, useState } from "react";
import { setObsessed, clearObsessed, type ProfileFormState } from "@/app/actions/profile";
import { MediaSearchField } from "@/components/MediaSearchField";
import { OBSESSED_KINDS, OBSESSED_LABELS, type ObsessedKind } from "@/lib/obsessed";

const initialState: ProfileFormState = {};

export type ObsessedDraft = {
  kind: ObsessedKind | null;
  title: string | null;
  note: string | null;
  imageUrl: string | null;
};

// The pinned slot. Searching is offered because it's the fast path to a
// title and some artwork, but every field stays editable afterwards - the
// point of the slot is that it says whatever the member wants, including
// something the catalogue has never heard of.
export function ObsessedPicker({ current, ownerId }: { current: ObsessedDraft; ownerId: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ObsessedKind>(current.kind ?? "artist");
  const [title, setTitle] = useState(current.title ?? "");
  const [note, setNote] = useState(current.note ?? "");
  const [imageUrl, setImageUrl] = useState(current.imageUrl ?? "");
  const [state, formAction, pending] = useActionState(setObsessed, initialState);

  // Closed by comparing against the previous action result during render
  // rather than from an effect: an effect here would commit the open panel
  // first and close it on a second pass.
  const [lastOk, setLastOk] = useState(state.ok);
  if (lastOk !== state.ok) {
    setLastOk(state.ok);
    if (state.ok) setOpen(false);
  }

  if (!open) {
    return (
      <button type="button" className="comment-action" onClick={() => setOpen(true)}>
        {current.title ? "Change obsession" : "Set what you're obsessed with"}
      </button>
    );
  }

  return (
    <div className="avatar-picker">
      {state.error && <div className="form-error">{state.error}</div>}

      <form action={formAction} className="comment-form">
        <input type="hidden" name="owner_id" value={ownerId} />
        <select value={kind} onChange={(e) => setKind(e.target.value as ObsessedKind)} name="kind">
          {OBSESSED_KINDS.map((k) => (
            <option value={k} key={k}>
              {OBSESSED_LABELS[k]}
            </option>
          ))}
        </select>

        <MediaSearchField
          placeholder="Search"
          onPick={(video) => {
            setTitle(video.title);
            setImageUrl(video.thumbnailUrl ?? "");
          }}
        />

        <input
          type="text"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What is it"
          maxLength={120}
          required
        />
        <input
          type="text"
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why"
          maxLength={140}
        />
        <input type="hidden" name="image_url" value={imageUrl} />

        {imageUrl && (
          <div className="track-selected">
            <img src={imageUrl} alt="" />
            <div>
              <b>{title || "Artwork"}</b>
            </div>
            <span className="clear" onClick={() => setImageUrl("")}>
              Remove art
            </span>
          </div>
        )}

        <div className="form-actions">
          <button className="btn" type="submit" disabled={pending || !title.trim()}>
            {pending ? "Saving…" : "Pin it"}
          </button>
          <button type="button" className="comment-action" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </form>

      {current.title && (
        <form action={clearObsessed}>
          <input type="hidden" name="owner_id" value={ownerId} />
          <button type="submit" className="comment-action danger">
            Clear obsession
          </button>
        </form>
      )}
    </div>
  );
}
