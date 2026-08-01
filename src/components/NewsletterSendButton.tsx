"use client";

import { useActionState } from "react";
import { sendNewsletterIssue, type NewsletterSendState } from "@/app/actions/newsletter";

const initialState: NewsletterSendState = {};

export function NewsletterSendButton({ issueId, subscriberCount }: { issueId: string; subscriberCount: number }) {
  const [state, formAction, pending] = useActionState(sendNewsletterIssue, initialState);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={issueId} />
      {state.error && <div className="form-error">{state.error}</div>}
      {state.ok && <div className="form-message">Sent to {state.sent} subscriber{state.sent === 1 ? "" : "s"}.</div>}
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Sending..." : `Send to Subscribers (${subscriberCount})`}
      </button>
    </form>
  );
}
