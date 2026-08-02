"use client";

import { useActionState } from "react";
import { generateNewsletterDraft, type NewsletterFormState } from "@/app/actions/newsletter";

const initialState: NewsletterFormState = {};

export function NewsletterGenerateButton({ issueId }: { issueId: string }) {
  const [state, formAction, pending] = useActionState(generateNewsletterDraft, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={issueId} />
      {state.error && <div className="form-error">{state.error}</div>}
      {state.ok && <div className="form-message">Draft generated - review the sections below before publishing.</div>}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Generating…" : "Generate with AI"}
      </button>
    </form>
  );
}
