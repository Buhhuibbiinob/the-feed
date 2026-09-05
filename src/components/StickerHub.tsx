"use client";

import { useActionState } from "react";
import { addHubSticker, removeHubSticker, type HubUploadState } from "@/app/actions/stickerHub";
import type { HubSticker } from "@/lib/stickerHub";

// The sticker hub: a grid, not a canvas.
//
// Everything that made stickers a decoration is missing on purpose -
// no dragging, no scaling, no rotation, no z-order. They sit in a box at
// one size, which is what turns a scrapbook back into a collection.

export function StickerHub({
  stickers,
  isOwner,
  ownerId,
}: {
  stickers: HubSticker[];
  isOwner: boolean;
  ownerId: string;
}) {
  const [state, add, adding] = useActionState<HubUploadState, FormData>(addHubSticker, {});

  // An empty hub is still shown to its owner - that is where the upload
  // lives, and a feature you can only find once you already have one is
  // a feature nobody finds.
  if (stickers.length === 0 && !isOwner) return null;

  return (
    <>
      <div className="sticker-hub">
      {stickers.map((sticker) => (
        <span className="sticker-hub-cell" key={sticker.id}>
          <img src={sticker.imageUrl} alt="" loading="lazy" />
          {isOwner && (
            <form action={removeHubSticker}>
              <input type="hidden" name="sticker_id" value={sticker.id} />
              <button type="submit" className="sticker-hub-remove" aria-label="Remove sticker">
                ×
              </button>
            </form>
          )}
        </span>
      ))}
      </div>
      {isOwner && (
        <form action={add} className="sticker-hub-add">
          <input type="hidden" name="owner_id" value={ownerId} />
          <input type="file" name="sticker_file" accept="image/*" aria-label="Add a sticker" />
          <button type="submit" className="btn btn-ghost" disabled={adding}>
            {adding ? "Adding…" : "Add sticker"}
          </button>
          {state.error && <div className="form-error">{state.error}</div>}
        </form>
      )}
    </>
  );
}
