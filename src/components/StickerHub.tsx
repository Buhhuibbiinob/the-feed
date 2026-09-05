"use client";

import { useActionState } from "react";
import { useState } from "react";
import {
  addHubSticker,
  addPackSticker,
  removeHubSticker,
  type HubUploadState,
} from "@/app/actions/stickerHub";
import { packStickerUrl, packStickersByGroup, STICKER_GROUPS } from "@/lib/stickerPack";
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
  const [picking, setPicking] = useState(false);
  const [group, setGroup] = useState<string>(STICKER_GROUPS[0]);
  const owned = new Set(stickers.map((s) => s.imageUrl));

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
        <>
          <div className="sticker-hub-tools">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setPicking((open) => !open)}
              aria-expanded={picking}
            >
              {picking ? "Done" : "Add from the pack"}
            </button>
          </div>
          {picking && (
            <div className="sticker-pack">
              <div className="seg sticker-pack-tabs">
                {STICKER_GROUPS.map((name) => (
                  <button
                    type="button"
                    key={name}
                    className={`seg-item${group === name ? " active" : ""}`}
                    onClick={() => setGroup(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div className="sticker-pack-grid">
                {packStickersByGroup(group).map((sticker) => {
                  const url = packStickerUrl(sticker.id);
                  const already = !!url && owned.has(url);
                  return (
                    <form action={addPackSticker} key={sticker.id}>
                      <input type="hidden" name="owner_id" value={ownerId} />
                      <input type="hidden" name="sticker_id" value={sticker.id} />
                      <button
                        type="submit"
                        className={`sticker-pack-cell${already ? " owned" : ""}`}
                        title={already ? `${sticker.label} - already yours` : sticker.label}
                        aria-label={sticker.label}
                        disabled={already}
                      >
                        <img src={url ?? ""} alt="" loading="lazy" />
                      </button>
                    </form>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
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
