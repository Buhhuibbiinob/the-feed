"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updatePassword, type AuthFormState } from "@/app/actions/auth";

const initialState: AuthFormState = {};

export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(updatePassword, initialState);

  return (
    <div className="auth-card panel">
      <div className="panel-head">Set a New Password</div>
      <div className="panel-body">
        {state.error && (
          <div className="form-error">
            {state.error} <Link href="/forgot-password">Request a new link</Link>.
          </div>
        )}

        <form action={formAction}>
          <div className="field">
            <label htmlFor="password">New Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div className="field">
            <label htmlFor="confirm_password">Confirm New Password</label>
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div className="form-actions">
            <button className="btn" type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save New Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
