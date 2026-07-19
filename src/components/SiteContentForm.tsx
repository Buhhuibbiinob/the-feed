"use client";

import { useActionState } from "react";
import { updateSiteContent, type SiteContentFormState } from "@/app/actions/siteContent";

const initialState: SiteContentFormState = {};

export function SiteContentForm({
  fieldKey,
  label,
  value,
}: {
  fieldKey: string;
  label: string;
  value: string;
}) {
  const [state, formAction, pending] = useActionState(updateSiteContent, initialState);

  return (
    <form action={formAction} className="comment-form">
      <input type="hidden" name="key" value={fieldKey} />
      <label className="theme-form-label">{label}</label>
      {state.error && <div className="form-error">{state.error}</div>}
      {state.ok && <div className="form-message">Saved.</div>}
      <textarea name="value" defaultValue={value} maxLength={500} rows={2} />
      <div className="form-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
