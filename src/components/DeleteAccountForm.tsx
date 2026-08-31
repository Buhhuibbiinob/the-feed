"use client";

import { useActionState, useState } from "react";
import { deleteMyAccount, type DeleteAccountState } from "@/app/actions/account";

const initialState: DeleteAccountState = {};

/**
 * Deleting your account, from inside the app.
 *
 * Kept shut behind a button rather than sitting open at the bottom of
 * Settings: a permanently visible "Delete everything" field is a thing
 * people hit by accident, and this is the one action here that cannot be
 * undone.
 */
export function DeleteAccountForm({ username }: { username: string }) {
  const [state, formAction, pending] = useActionState(deleteMyAccount, initialState);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <>
        <p className="field-hint" style={{ marginTop: 0 }}>
          Deleting your account removes your reviews, comments, lists and messages. It cannot be
          undone.
        </p>
        <button type="button" className="comment-action danger" onClick={() => setOpen(true)}>
          Delete my account
        </button>
      </>
    );
  }

  return (
    <form action={formAction} className="comment-form">
      {state.error && <div className="form-error">{state.error}</div>}
      <p className="field-hint" style={{ marginTop: 0 }}>
        This deletes everything: your reviews, comments, ratings, lists, messages and profile.
        Nobody can restore it, including us.
      </p>
      <div className="field">
        <label htmlFor="confirm-delete">
          Type <b>{username}</b> to confirm
        </label>
        <input id="confirm-delete" name="confirm" type="text" autoComplete="off" required />
      </div>
      <div className="form-actions">
        <button type="button" className="comment-action" onClick={() => setOpen(false)}>
          Keep my account
        </button>
        <button className="btn danger" type="submit" disabled={pending}>
          {pending ? "Deleting…" : "Delete permanently"}
        </button>
      </div>
    </form>
  );
}
