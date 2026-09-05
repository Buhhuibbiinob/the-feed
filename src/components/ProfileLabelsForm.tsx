"use client";

import { useActionState, useState } from "react";
import { setProfileLabel, type LabelFormState } from "@/app/actions/profileLabels";
import {
  MAX_PROFILE_LABEL,
  PROFILE_LABELS,
  type ProfileLabels,
} from "@/lib/profileLabels";

// One row per piece of wording. Each saves on its own, because a single
// Save at the bottom of twenty-two fields is a form you have to be brave
// to use.

function LabelRow({
  labelKey,
  shipped,
  hint,
  current,
}: {
  labelKey: string;
  shipped: string;
  hint: string;
  current: string;
}) {
  const [state, save, saving] = useActionState<LabelFormState, FormData>(setProfileLabel, {});
  const [value, setValue] = useState(current);

  return (
    <form action={save} className="label-row">
      <input type="hidden" name="key" value={labelKey} />
      <div className="label-row-main">
        <input
          name="value"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={MAX_PROFILE_LABEL}
          placeholder={shipped}
          aria-label={hint}
        />
        <button type="submit" className="btn btn-ghost" disabled={saving || value === current}>
          {saving ? "…" : "Save"}
        </button>
      </div>
      <div className="field-hint">
        {hint}
        {value.trim() && value.trim() !== shipped && ` Shipped as "${shipped}" - clear to restore.`}
        {state.error && <b> {state.error}</b>}
        {state.ok && <b> Saved.</b>}
      </div>
    </form>
  );
}

export function ProfileLabelsForm({ labels }: { labels: ProfileLabels }) {
  return (
    <div className="panel">
      <div className="panel-head">Profile Text</div>
      <div className="panel-body">
        <div className="tagline" style={{ marginBottom: 12 }}>
          Every heading and label on a profile. Rename anything you don&apos;t
          like; leave a box empty to put the original word back.
        </div>
        {PROFILE_LABELS.map((l) => (
          <LabelRow
            key={l.key}
            labelKey={l.key}
            shipped={l.label}
            hint={l.hint}
            current={labels[l.key]}
          />
        ))}
      </div>
    </div>
  );
}
