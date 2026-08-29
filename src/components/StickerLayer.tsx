"use client";

import { useSyncExternalStore, useActionState, useRef, useState } from "react";
import { Portal } from "@/components/Portal";
import {
  decorateServerSnapshot,
  isDecorating,
  subscribeDecorate,
} from "@/lib/decorate";
import {
  deleteSticker,
  placeSticker,
  uploadSticker,
  type StickerState,
} from "@/app/actions/stickers";
import { MAX_STICKERS, stickerTransform, Z_BEHIND, Z_FRONT, type Sticker } from "@/lib/stickers";

const initialState: StickerState = {};

/**
 * Stickers scattered over the whole profile.
 *
 * The layer NEVER takes pointer events itself, only the sticker images
 * inside it do. An earlier version made the layer interactive while
 * editing, which covered the entire page including the sticker controls
 * underneath it - so Remove, the sliders and the file picker all looked
 * dead, because every click was landing on a transparent sheet. Pointer
 * capture on the image is what keeps a drag working without the layer
 * needing to intercept anything.
 *
 * Two layers, split by the sign of z: one painted under the panels and
 * one over them. A single layer can't do both, because giving it a
 * z-index makes it a stacking context its children can't escape.
 *
 * The tools panel is portaled to <body> for the same reason the
 * Decorate bar is: the page-transition wrapper keeps a transform, and a
 * transformed element becomes the containing block for its `position:
 * fixed` descendants. Authored in place, the panel anchored to the foot
 * of the profile instead of the screen, so it scrolled away from the
 * Decorate button it belongs next to.
 *
 * It has no toggle of its own any more. Decorating is one mode with one
 * switch - a second button that did exactly what Decorate does was just
 * something else to read.
 */
function StickerImage({
  sticker,
  editing,
  selected,
  onSelect,
  onMove,
  onCommit,
}: {
  sticker: Sticker;
  editing: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onCommit: (id: string) => void;
}) {
  const dragging = useRef<number | null>(null);

  function layerBox(el: HTMLElement) {
    return el.parentElement?.getBoundingClientRect() ?? null;
  }

  return (
    <img
      src={sticker.imageUrl}
      alt=""
      className={`sticker${selected && editing ? " selected" : ""}`}
      style={{
        left: `${sticker.x}%`,
        // Both axes are a share of the profile's WIDTH. Horizontal is a
        // plain percentage; vertical uses cqw - one percent of the
        // container's inline size - because a percentage top would be a
        // share of HEIGHT, and the page's height changes every time
        // someone posts a review or opens the tools.
        //
        // This used to read off a fixed 880px design width, which forced
        // the whole profile to render at 880 and zoom down. Against the
        // container instead, the same number lands in the same place at
        // any width, so the profile can be a normal responsive page and
        // an arrangement still travels between devices intact.
        top: `calc(${sticker.y} * 1cqw)`,
        width: `${14 * sticker.scale}%`,
        transform: stickerTransform(sticker),
      }}
      draggable={false}
      onPointerDown={(e) => {
        if (!editing) return;
        e.preventDefault();
        onSelect(sticker.id);
        dragging.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (dragging.current !== e.pointerId) return;
        const box = layerBox(e.currentTarget);
        if (!box || box.width === 0) return;
        // box.width divides BOTH axes: y is in width-units to match how
        // it's rendered. Using box.height here is what made a sticker
        // jump as soon as the page got taller or shorter.
        onMove(
          sticker.id,
          ((e.clientX - box.left) / box.width) * 100,
          ((e.clientY - box.top) / box.width) * 100
        );
      }}
      onPointerUp={(e) => {
        if (dragging.current !== e.pointerId) return;
        dragging.current = null;
        onCommit(sticker.id);
      }}
      onPointerCancel={() => {
        dragging.current = null;
      }}
    />
  );
}

export function StickerLayer({
  stickers,
  isOwner,
}: {
  stickers: Sticker[];
  isOwner: boolean;
}) {
  // Was local state with its own button. The whole page enters
  // decorating mode together now, so stickers and panels are not two
  // separate things you have to switch on one at a time.
  const editing = useSyncExternalStore(subscribeDecorate, isDecorating, decorateServerSnapshot);
  const [local, setLocal] = useState<Sticker[]>(stickers);
  const [selected, setSelected] = useState<string | null>(null);
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

  async function save(sticker: Sticker) {
    const data = new FormData();
    data.set("id", sticker.id);
    data.set("x", String(sticker.x));
    data.set("y", String(sticker.y));
    data.set("scale", String(sticker.scale));
    data.set("scale_y", String(sticker.scaleY));
    data.set("rotation", String(sticker.rotation));
    data.set("skew", String(sticker.skew));
    data.set("z", String(sticker.z));
    await placeSticker(data);
  }

  function commit(id: string) {
    const sticker = local.find((s) => s.id === id);
    if (sticker) void save(sticker);
  }

  function adjust(id: string, changes: Partial<Sticker>) {
    const current = local.find((s) => s.id === id);
    if (!current) return;
    patch(id, changes);
    void save({ ...current, ...changes });
  }

  const active = local.find((s) => s.id === selected) ?? null;

  const renderLayer = (behind: boolean) => (
    <div
      className={`sticker-layer${behind ? " behind" : " front"}${editing ? " editing" : ""}${
        behind && editing ? " ghost" : ""
      }`}
    >
      {local
        .filter((s) => (s.z < 0) === behind)
        .map((sticker) => (
          <StickerImage
            key={sticker.id}
            sticker={sticker}
            editing={editing}
            selected={selected === sticker.id}
            onSelect={setSelected}
            onMove={(id, x, y) => patch(id, { x, y })}
            onCommit={commit}
          />
        ))}
    </div>
  );

  // Nudging with the keyboard, so placing a sticker doesn't require a
  // mouse. Same step as a slow drag.
  function nudge(dx: number, dy: number) {
    if (!active) return;
    adjust(active.id, { x: active.x + dx, y: active.y + dy });
  }

  return (
    <>
      {renderLayer(true)}
      {renderLayer(false)}

      {isOwner && editing && (
        <Portal>
          <div className="sticker-tools floating">
            <div className="sticker-tools-head">Stickers</div>
            {state.error && <div className="form-error">{state.error}</div>}
            <form action={formAction} className="sticker-upload">
              <label className="sr-only" htmlFor="sticker-file">
                Sticker image
              </label>
              <input
                key={uploadKey}
                id="sticker-file"
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
              Drag them anywhere. Transparent PNGs work best. {MAX_STICKERS} max.
            </div>

            {local.length > 0 && (
              <div className="sticker-picker">
                {local.map((sticker) => (
                  <button
                    type="button"
                    key={sticker.id}
                    className={`sticker-chip${selected === sticker.id ? " active" : ""}`}
                    onClick={() => setSelected(sticker.id)}
                    aria-pressed={selected === sticker.id}
                    aria-label={`Select sticker${sticker.z < 0 ? ", behind panels" : ""}`}
                  >
                    <img src={sticker.imageUrl} alt="" />
                  </button>
                ))}
              </div>
            )}

            {active && (
              <div className="sticker-controls">
                <label>
                  Width
                  <input
                    type="range"
                    min={0.05}
                    max={12}
                    step={0.05}
                    value={active.scale}
                    onChange={(e) => patch(active.id, { scale: Number(e.target.value) })}
                    onPointerUp={() => commit(active.id)}
                    onKeyUp={() => commit(active.id)}
                  />
                </label>
                <label>
                  Height
                  <input
                    type="range"
                    min={0.05}
                    max={12}
                    step={0.05}
                    value={active.scaleY}
                    onChange={(e) => patch(active.id, { scaleY: Number(e.target.value) })}
                    onPointerUp={() => commit(active.id)}
                    onKeyUp={() => commit(active.id)}
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
                    onPointerUp={() => commit(active.id)}
                    onKeyUp={() => commit(active.id)}
                  />
                </label>
                <label>
                  Warp
                  <input
                    type="range"
                    min={-60}
                    max={60}
                    step={1}
                    value={active.skew}
                    onChange={(e) => patch(active.id, { skew: Number(e.target.value) })}
                    onPointerUp={() => commit(active.id)}
                    onKeyUp={() => commit(active.id)}
                  />
                </label>

                <div className="sticker-nudge">
                  <span>Nudge</span>
                  <button type="button" className="comment-action" onClick={() => nudge(0, -1)} aria-label="Move up">
                    ↑
                  </button>
                  <button type="button" className="comment-action" onClick={() => nudge(0, 1)} aria-label="Move down">
                    ↓
                  </button>
                  <button type="button" className="comment-action" onClick={() => nudge(-1, 0)} aria-label="Move left">
                    ←
                  </button>
                  <button type="button" className="comment-action" onClick={() => nudge(1, 0)} aria-label="Move right">
                    →
                  </button>
                </div>

                <div className="sticker-actions">
                  <button
                    type="button"
                    className="comment-action"
                    onClick={() => adjust(active.id, { z: active.z < 0 ? Z_FRONT : Z_BEHIND })}
                  >
                    {active.z < 0 ? "Bring in front" : "Send behind panels"}
                  </button>
                  <form action={deleteSticker}>
                    <input type="hidden" name="id" value={active.id} />
                    <button type="submit" className="comment-action danger">
                      Remove
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </Portal>
      )}
    </>
  );
}
