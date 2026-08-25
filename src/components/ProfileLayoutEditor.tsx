"use client";

import { useActionState, useState } from "react";
import { updateProfileLayout, type ProfileFormState } from "@/app/actions/profile";
import { encodeProfileLayout, sectionLabel, type LayoutEntry } from "@/lib/profileLayout";

const initialState: ProfileFormState = {};

// Reordering is drag-and-drop where a pointer can do it, plus Move up /
// Move down buttons everywhere. The buttons aren't an accessibility
// afterthought: on a phone, dragging inside a scrolling page is the worse
// of the two interactions, and phones are where people fiddle with their
// profile.
export function ProfileLayoutEditor({ layout }: { layout: LayoutEntry[] }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<LayoutEntry[]>(layout);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [state, formAction, pending] = useActionState(updateProfileLayout, initialState);

  // Closed by comparing against the previous action result during render
  // rather than from an effect: an effect here would commit the open panel
  // first and close it on a second pass.
  const [lastOk, setLastOk] = useState(state.ok);
  if (lastOk !== state.ok) {
    setLastOk(state.ok);
    if (state.ok) setOpen(false);
  }

  // A saved layout re-renders the server component with a new order; adopt
  // it instead of holding stale local state.
  const [lastLayout, setLastLayout] = useState(layout);
  if (lastLayout !== layout) {
    setLastLayout(layout);
    setEntries(layout);
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= entries.length) return;
    setEntries((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function toggle(index: number) {
    setEntries((current) => current.map((e, i) => (i === index ? { ...e, shown: !e.shown } : e)));
  }

  if (!open) {
    return (
      <button type="button" className="comment-action" onClick={() => setOpen(true)}>
        Rearrange profile
      </button>
    );
  }

  return (
    <div className="avatar-picker layout-editor">
      {state.error && <div className="form-error">{state.error}</div>}
      <div className="field-hint">Drag a row, or use the arrows. Untick to hide a section.</div>

      <ul className="layout-list">
        {entries.map((entry, index) => (
          <li
            key={entry.id}
            className={`layout-row${entry.shown ? "" : " off"}${dragIndex === index ? " dragging" : ""}`}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragEnd={() => setDragIndex(null)}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragIndex === null || dragIndex === index) return;
              move(dragIndex, index);
              setDragIndex(index);
            }}
          >
            <span className="layout-grip" aria-hidden="true">
              ⠿
            </span>
            <label className="layout-label">
              <input type="checkbox" checked={entry.shown} onChange={() => toggle(index)} />
              {sectionLabel(entry.id)}
            </label>
            <span className="layout-move">
              <button
                type="button"
                className="comment-action"
                onClick={() => move(index, index - 1)}
                disabled={index === 0}
                aria-label={`Move ${sectionLabel(entry.id)} up`}
              >
                ↑
              </button>
              <button
                type="button"
                className="comment-action"
                onClick={() => move(index, index + 1)}
                disabled={index === entries.length - 1}
                aria-label={`Move ${sectionLabel(entry.id)} down`}
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ul>

      <form action={formAction} className="comment-form">
        <input type="hidden" name="layout" value={encodeProfileLayout(entries).join(",")} />
        <div className="form-actions">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save layout"}
          </button>
          <button
            type="button"
            className="comment-action"
            onClick={() => {
              setEntries(layout);
              setOpen(false);
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
