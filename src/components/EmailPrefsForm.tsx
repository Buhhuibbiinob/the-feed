"use client";

import { useActionState, useState } from "react";
import { updateEmailPrefs, type EmailPrefsState } from "@/app/actions/notifications";
import {
  EMAIL_EVENTS,
  EMAIL_MODES,
  EMAIL_MODE_LABELS,
  type EmailPrefs,
} from "@/lib/emailPrefs";

const initialState: EmailPrefsState = {};

export function EmailPrefsForm({ prefs }: { prefs: EmailPrefs }) {
  const [state, formAction, pending] = useActionState(updateEmailPrefs, initialState);
  const [saved, setSaved] = useState(false);

  const [lastOk, setLastOk] = useState(state.ok);
  if (lastOk !== state.ok) {
    setLastOk(state.ok);
    setSaved(!!state.ok);
  }

  return (
    <form action={formAction} className="comment-form email-prefs">
      {state.error && <div className="form-error">{state.error}</div>}
      <p className="field-hint" style={{ marginTop: 0 }}>
        Digests batch everything into one email every few hours instead of one per event.
      </p>

      {EMAIL_EVENTS.map((event) => (
        <label className="email-pref-row" key={event.key}>
          <span>{event.label}</span>
          <select name={event.key} defaultValue={prefs[event.key]} onChange={() => setSaved(false)}>
            {EMAIL_MODES.map((mode) => (
              <option value={mode} key={mode}>
                {EMAIL_MODE_LABELS[mode]}
              </option>
            ))}
          </select>
        </label>
      ))}

      <div className="form-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save email settings"}
        </button>
        {saved && <span className="field-hint">Saved.</span>}
      </div>
    </form>
  );
}
