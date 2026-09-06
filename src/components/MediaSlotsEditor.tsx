"use client";

import { useActionState, useState } from "react";
import { clearMediaSlot, setMediaSlot, type SlotFormState } from "@/app/actions/mediaSlots";
import { ALL_SLOTS, type MediaSlot, type SlotIndex } from "@/lib/mediaSlots";

// Filling the six boxes.
//
// One form per box, each saving on its own - the boxes are independent,
// and a single Save across six of them would mean losing five edits to
// one mistake.

const WHERE: Record<SlotIndex, string> = {
  0: "Top left",
  1: "Top middle",
  2: "Top right",
  3: "Bottom left",
  4: "Bottom middle",
  5: "Bottom right",
};

function SlotForm({ slot, current, ownerId }: { slot: SlotIndex; current?: MediaSlot; ownerId: string }) {
  const [state, save, saving] = useActionState<SlotFormState, FormData>(setMediaSlot, {});
  const [kind, setKind] = useState<"image" | "video">(current?.kind ?? "image");

  return (
    <div className="slot-editor">
      <form action={save}>
        <input type="hidden" name="owner_id" value={ownerId} />
        <input type="hidden" name="slot" value={slot} />
        <div className="field">
          <label htmlFor={`slot-kind-${slot}`}>
            {WHERE[slot]}
            {slot === 0 && " (your picture, by default)"}
          </label>
          <select
            id={`slot-kind-${slot}`}
            name="kind"
            value={kind}
            onChange={(e) => setKind(e.target.value === "video" ? "video" : "image")}
          >
            <option value="image">A picture</option>
            <option value="video">A music video (plays on its own, muted)</option>
          </select>
        </div>
        {kind === "video" ? (
          <div className="field">
            <label htmlFor={`slot-yt-${slot}`}>YouTube link</label>
            <input
              id={`slot-yt-${slot}`}
              name="youtube"
              type="text"
              defaultValue={current?.youtubeId ?? ""}
              placeholder="https://youtube.com/watch?v=..."
            />
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor={`slot-file-${slot}`}>Choose a file</label>
              <input id={`slot-file-${slot}`} name="image_file" type="file" accept="image/*" />
            </div>
            <div className="field">
              <label htmlFor={`slot-img-${slot}`}>…or paste an image URL</label>
              <input
                id={`slot-img-${slot}`}
                name="image_url"
                type="text"
                defaultValue={current?.imageUrl ?? ""}
                placeholder="https://..."
              />
            </div>
          </>
        )}
        <div className="field">
          <label htmlFor={`slot-title-${slot}`}>Caption (optional)</label>
          <input id={`slot-title-${slot}`} name="title" type="text" defaultValue={current?.title ?? ""} maxLength={60} />
        </div>
        {state.error && <div className="form-error">{state.error}</div>}
        {state.ok && <div className="form-message">Saved.</div>}
        <div className="form-actions">
          <button type="submit" className="btn" disabled={saving}>
            {saving ? "Saving…" : "Save box"}
          </button>
        </div>
      </form>
      {current && (
        <form action={clearMediaSlot}>
          <input type="hidden" name="owner_id" value={ownerId} />
          <input type="hidden" name="slot" value={slot} />
          <button type="submit" className="comment-action">
            Clear it and put the automatic one back
          </button>
        </form>
      )}
    </div>
  );
}

export function MediaSlotsEditor({ slots, ownerId }: { slots: MediaSlot[]; ownerId: string }) {
  const byIndex = new Map(slots.map((s) => [s.slot, s]));
  return (
    <div className="panel" id="media-boxes">
      <div className="panel-head">The six boxes</div>
      <div className="panel-body">
        <div className="tagline" style={{ marginBottom: 10 }}>
          Three across the top, three along the bottom. Fill any of them with
          a picture or a music video. Anything you leave empty shows one of
          your reviews, the way it does now.
        </div>
        <div className="slot-editor-grid">
          {ALL_SLOTS.map((slot) => (
            <SlotForm key={slot} slot={slot} current={byIndex.get(slot)} ownerId={ownerId} />
          ))}
        </div>
      </div>
    </div>
  );
}
