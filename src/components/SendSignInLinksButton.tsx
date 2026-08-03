"use client";

import { useActionState } from "react";
import { adminSendSignInLinks, type BroadcastState } from "@/app/actions/broadcast";

const initialState: BroadcastState = {};

export function SendSignInLinksButton() {
  const [state, formAction, pending] = useActionState(adminSendSignInLinks, initialState);

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}
      {state.ok && (
        <div className="form-message">
          Sent {state.sent} sign-in {state.sent === 1 ? "link" : "links"}.
          {state.failed ? ` ${state.failed} failed.` : ""}
          {state.skipped ? ` ${state.skipped} skipped (test addresses).` : ""}
        </div>
      )}
      <div className="field">
        <label htmlFor="confirm-send">Type SEND to confirm</label>
        <input id="confirm-send" name="confirm" type="text" autoComplete="off" placeholder="SEND" />
      </div>
      <div className="form-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Sending…" : "Email everyone a sign-in link"}
        </button>
      </div>
    </form>
  );
}
