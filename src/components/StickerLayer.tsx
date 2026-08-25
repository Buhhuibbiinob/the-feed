"use client";

import { useActionState, useRef, useState } from "react";
import {
  deleteSticker,
  placeSticker,
  uploadSticker,
  type StickerState,
} from "@/app/actions/stickers";
import { MAX_STICKERS, type Sticker } from "@/lib/stickers";

const initialState: StickerState = {};

/**
 * Stickers scattered anywhere over the profile, not stuck to the photo.
 *
 * The layer covers the whole profile column area and sits above the
 * panels. When nobody is editing it ignores the pointer entirely, so a
 * sticker sitting over a link doesn't stop you clicking the link - which
 * is the thing that makes a free-floating layer usable rather than a trap.
 *
 * Coordinates are a percentage of the layer, so a sticker keeps its place
 * as the page reflows between desktop and phone.
 */
export function StickerLayer({
  stickers,
  isOwner,
}: {
  stickers: Sticker[];
  isOwner: boolean;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState<Sticker[]>(stickers);
  const [selected, setSelected] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; pointerId: number } | null>(null);
  const [state, formAction, pending] = useActionState(uploadSticker, initialState);

  const [lastStickers, setLastStickers] = useState(stickers);
  if (lastStickers !== stickers) {
    setLastStickers(stickers);
    setLocal(stickers);
  }

  const [uploadKey, setUploadKey] = useState(0);
  const [lastOk, setLastOk] = useState(state.ok);
  if (lastOk !== state.ok) {
    setLastOk(state.ok);
    if (state.ok) setUploadKey((n) => n + 1);
  }

  function patch(id: string, changes: Partial<Sticker>) {
    setLocal((current) => current.map((s) => (s.id === id ? { ...s, ...changes } : s)));
  }

  function handlePointerDown(e: React.PointerEvent, id: string) {
    if (!editing) return;
    e.preventDefault();
    setSelected(id);
    dragRef.current = { id, pointerId: e.pointerId };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    const box = layerRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return;
    patch(dragRef.current.id, {
      x: ((e.clientX - box.left) / box.width) * 100,
      y: ((e.clientY - box.top) / box.height) * 100,
    });
  }

  function handlePointerUp(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    const sticker = local.find((s) => s.id === drag.id);
    if (sticker) void save(sticker);
  }

  async function save(sticker: Sticker) {
    const data = new FormData();
    data.set("id", sticker.id);
    data.set("x", String(sticker.x));
    data.set("y", String(sticker.y));
    data.set("scale", String(sticker.scale));
    data.set("rotation", String(sticker.rotation));
    await placeSticker(data);
  }

  function adjust(id: string, changes: Partial<Sticker>) {
    const current = local.find((s) => s.id === id);
    if (!current) return;
    patch(id, changes);
    void save({ ...current, ...changes });
  }

  const active = local.find((s) => s.id === selected) ?? null;

  return (
    <>
      <div
        ref={layerRef}
        className={`sticker-layer${editing ? " editing" : ""}`}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {local.map((sticker) => (
          <img
            key={sticker.id}
            src={sticker.imageUrl}
            alt=""
            className={`sticker${selected === sticker.id && editing ? " selected" : ""}`}
            style={{
              left: `${sticker.x}%`,
              top: `${sticker.y}%`,
              width: `${14 * sticker.scale}%`,
              transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg)`,
              zIndex: sticker.z,
            }}
            onPointerDown={(e) => handlePointerDown(e, sticker.id)}
            draggable={false}
          />
        ))}
      </div>

      {isOwner && (
        <div className="sticker-tools">
          <button type="button" className="comment-action" onClick={() => setEditing((v) => !v)}>
            {editing ? "Done stickering" : "Stickers"}
          </button>

          {editing && (
            <>
              {state.error && <div className="form-error">{state.error}</div>}
              <form action={formAction} className="sticker-upload">
                <input
                  key={uploadKey}
                  type="file"
                  name="sticker_file"
                  accept="image/*"
                  required
                />
                <button className="btn" type="submit" disabled={pending}>
                  {pending ? "Adding…" : "Add"}
                </button>
              </form>
              <div className="field-hint">
                Drag them anywhere on the page. Transparent PNGs work best. {MAX_STICKERS} max.
              </div>

              {active ? (
                <div className="sticker-controls">
                  <label>
                    Size
                    <input
                      type="range"
                      min={0.25}
                      max={3}
                      step={0.05}
                      value={active.scale}
                      onChange={(e) => patch(active.id, { scale: Number(e.target.value) })}
                      onPointerUp={() => adjust(active.id, { scale: active.scale })}
                    />
                  </label>
                  <label>
                    Turn
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      step={1}
                      value={active.rotation}
                      onChange={(e) => patch(active.id, { rotation: Number(e.target.value) })}
                      onPointerUp={() => adjust(active.id, { rotation: active.rotation })}
                    />
                  </label>
                  <form action={deleteSticker}>
                    <input type="hidden" name="id" value={active.id} />
                    <button type="submit" className="comment-action danger">
                      Remove
                    </button>
                  </form>
                </div>
              ) : (
                local.length > 0 && <div className="field-hint">Tap one to resize or turn it.</div>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
