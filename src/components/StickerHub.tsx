"use client";

import { removeHubSticker } from "@/app/actions/stickerHub";
import type { HubSticker } from "@/lib/stickerHub";

// The sticker hub: a grid, not a canvas.
//
// Everything that made stickers a decoration is missing on purpose -
// no dragging, no scaling, no rotation, no z-order. They sit in a box at
// one size, which is what turns a scrapbook back into a collection.

export function StickerHub({
  stickers,
  isOwner,
}: {
  stickers: HubSticker[];
  isOwner: boolean;
}) {
  if (stickers.length === 0) return null;

  return (
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
  );
}
