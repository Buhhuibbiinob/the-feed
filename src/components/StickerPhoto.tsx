"use client";

import { useActionState, useRef, useState } from "react";
import {
  deleteSticker,
  placeSticker,
  uploadSticker,
  type StickerState,
} from "@/app/actions/stickers";
import { MAX_STICKERS, MAX_STICKER_BYTES, type Sticker } from "@/lib/stickers";

const initialState: StickerState = {};

/**
 * The profile photo with stickers stuck on it.
 *
 * Dragging is pointer-based rather than HTML5 drag-and-drop: the native
 * API has no useful touch support and drags a ghost image around, neither
 * of which suits sticking a sticker to a photo with your thumb.
 *
 * Position is kept in local state while dragging and written once on
 * release - saving on every pointer move would be hundreds of requests to
 * place one sticker.
 */
export function StickerPhoto({
  avatarUrl,
  username,
  stickers,
  isOwner,
}: {
  avatarUrl: string;
  username: string;
  stickers: Sticker[];
  isOwner: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState<Sticker[]>(stickers);
  const [selected, setSelected] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; pointerId: number } | null>(null);
  const [state, formAction, pending] = useActionState(uploadSticker, initialState);

  // Adopt the server's list whenever it changes underneath us.
  const [lastStickers, setLastStickers] = useState(stickers);
  if (lastStickers !== stickers) {
    setLastStickers(stickers);
    setLocal(stickers);
  }

  // A successful upload clears the file input by remounting it. Calling
  // form.reset() through a ref would mean touching a ref during render,
  // and a key bump is the way React actually wants an uncontrolled input
  // cleared.
  const [uploadKey, setUploadKey] = useState(0);
  const [lastOk, setLastOk] = useState(state.ok);
  if (lastOk !== state.ok) {
    setLastOk(state.ok);
    if (state.ok) setUploadKey((n) => n + 1);
  }

  function patch(id: string, changes: Partial<Sticker>) {
    setLocal((current) => current.map((s) => (s.id === id ? { ...s, ...changes } : s)));
  }

  function pointFromEvent(e: React.PointerEvent) {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return null;
    return {
      x: ((e.clientX - box.left) / box.width) * 100,
      y: ((e.clientY - box.top) / box.height) * 100,
    };
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
    const point = pointFromEvent(e);
    if (point) patch(dragRef.current.id, point);
  }

  function handlePointerUp(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;

    // One save, on release.
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
    const next = local.find((s) => s.id === id);
    if (!next) return;
    const updated = { ...next, ...changes };
    patch(id, changes);
    void save(updated);
  }

  const active = local.find((s) => s.id === selected) ?? null;

  return (
    <div className="sticker-photo">
      <div
        ref={boxRef}
        className={`sticker-box${editing ? " editing" : ""}`}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <img src={avatarUrl} alt={username} className="sticker-base" />
        {local.map((sticker) => (
          <img
            key={sticker.id}
            src={sticker.imageUrl}
            alt=""
            className={`sticker${selected === sticker.id && editing ? " selected" : ""}`}
            style={{
              left: `${sticker.x}%`,
              top: `${sticker.y}%`,
              transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg) scale(${sticker.scale})`,
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
            {editing ? "Done stickering" : "Add stickers"}
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
                PNGs with transparent backgrounds look best. Up to {MAX_STICKERS}, max{" "}
                {MAX_STICKER_BYTES / 1024 / 1024}MB each. Drag one to move it.
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
                  <div className="form-actions">
                    <form action={deleteSticker}>
                      <input type="hidden" name="id" value={active.id} />
                      <button type="submit" className="comment-action danger">
                        Remove sticker
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                local.length > 0 && <div className="field-hint">Tap a sticker to resize or turn it.</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
