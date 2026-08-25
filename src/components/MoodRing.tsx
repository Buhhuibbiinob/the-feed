"use client";

import { useActionState, useState } from "react";
import { setMood, type PageConfigState } from "@/app/actions/pageConfig";

const initialState: PageConfigState = {};

const QUICK_MOODS = ["🔥", "🫠", "🥀", "🪩", "😌", "👻", "🧊", "💿", "🌙", "⚡"];

export function MoodRingEditor({
  emoji,
  color,
  text,
}: {
  emoji: string | null;
  color: string | null;
  text: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [draftEmoji, setDraftEmoji] = useState(emoji ?? "🔥");
  const [draftColor, setDraftColor] = useState(color ?? "#ff2f8e");
  const [state, formAction, pending] = useActionState(setMood, initialState);

  const [lastOk, setLastOk] = useState(state.ok);
  if (lastOk !== state.ok) {
    setLastOk(state.ok);
    if (state.ok) setOpen(false);
  }

  if (!open) {
    return (
      <button type="button" className="comment-action" onClick={() => setOpen(true)}>
        {emoji ? "Change mood" : "Set a mood"}
      </button>
    );
  }

  return (
    <div className="avatar-picker">
      {state.error && <div className="form-error">{state.error}</div>}
      <form action={formAction} className="comment-form">
        <div className="mood-quick">
          {QUICK_MOODS.map((option) => (
            <button
              type="button"
              key={option}
              className={`mood-quick-btn${draftEmoji === option ? " active" : ""}`}
              onClick={() => setDraftEmoji(option)}
            >
              {option}
            </button>
          ))}
        </div>
        <input
          type="text"
          name="emoji"
          value={draftEmoji}
          onChange={(e) => setDraftEmoji(e.target.value)}
          maxLength={4}
          aria-label="Mood emoji"
          className="mood-emoji-input"
        />
        <input type="text" name="text" defaultValue={text ?? ""} placeholder="In a few words…" maxLength={60} />
        <label className="skin-field">
          <span>Ring colour</span>
          <input
            type="color"
            name="color"
            value={draftColor}
            onChange={(e) => setDraftColor(e.target.value)}
            aria-label="Ring colour"
          />
        </label>
        <div className="form-actions">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save mood"}
          </button>
          <button type="button" className="comment-action" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
