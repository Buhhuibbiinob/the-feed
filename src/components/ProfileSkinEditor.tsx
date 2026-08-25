"use client";

import { useActionState, useState } from "react";
import { updateProfileSkin, type ProfileFormState } from "@/app/actions/profile";
import { SKIN_PRESETS, type ProfileSkin } from "@/lib/profileSkin";

const initialState: ProfileFormState = {};

const FIELDS = [
  { key: "bg", name: "profile_bg_color", label: "Background" },
  { key: "panel", name: "profile_panel_color", label: "Panels" },
  { key: "text", name: "profile_text_color", label: "Text" },
  { key: "accent", name: "profile_accent_color", label: "Accent" },
] as const;

// Colours a visitor sees on this profile. Deliberately not the same control
// as Settings > Theme, which changes what *you* see everywhere.
//
// A colour input can't express "unset", so each row pairs the swatch with a
// Clear button; clearing sends an empty string and the profile falls back
// to whatever theme the visitor is on.
export function ProfileSkinEditor({ skin }: { skin: ProfileSkin }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ProfileSkin>(skin);
  const [state, formAction, pending] = useActionState(updateProfileSkin, initialState);

  // Closed by comparing against the previous action result during render
  // rather than from an effect: an effect here would commit the open panel
  // first and close it on a second pass.
  const [lastOk, setLastOk] = useState(state.ok);
  if (lastOk !== state.ok) {
    setLastOk(state.ok);
    if (state.ok) setOpen(false);
  }

  const [lastSkin, setLastSkin] = useState(skin);
  if (lastSkin !== skin) {
    setLastSkin(skin);
    setDraft(skin);
  }

  if (!open) {
    return (
      <button type="button" className="comment-action" onClick={() => setOpen(true)}>
        Profile colours
      </button>
    );
  }

  return (
    <div className="avatar-picker skin-editor">
      {state.error && <div className="form-error">{state.error}</div>}

      <div className="skin-presets">
        {SKIN_PRESETS.map((preset) => (
          <button
            type="button"
            key={preset.id}
            className="skin-preset"
            onClick={() => setDraft(preset.skin)}
            title={preset.label}
          >
            <span
              className="skin-preset-swatch"
              style={{
                background: preset.skin.bg ?? "transparent",
                borderColor: preset.skin.accent ?? "#bbb",
              }}
            />
            {preset.label}
          </button>
        ))}
      </div>

      <form action={formAction} className="comment-form">
        <div className="skin-fields">
          {FIELDS.map((field) => (
            <label className="skin-field" key={field.key}>
              <span>{field.label}</span>
              <input
                type="color"
                value={draft[field.key] ?? "#ffffff"}
                onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
                aria-label={field.label}
              />
              <input type="hidden" name={field.name} value={draft[field.key] ?? ""} />
              <button
                type="button"
                className="comment-action"
                onClick={() => setDraft({ ...draft, [field.key]: null })}
                disabled={draft[field.key] === null}
              >
                Clear
              </button>
            </label>
          ))}
        </div>

        <div className="form-actions">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save colours"}
          </button>
          <button
            type="button"
            className="comment-action"
            onClick={() => {
              setDraft(skin);
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
