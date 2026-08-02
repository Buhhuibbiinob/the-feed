"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type AuthFormState } from "@/app/actions/auth";

const initialState: AuthFormState = {};

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <div className="auth-card panel">
      <div className="panel-head">Forgot Password</div>
      <div className="panel-body">
        {state.error && <div className="form-error">{state.error}</div>}
        {state.message && <div className="form-message">{state.message}</div>}

        {!state.message && (
          <form action={formAction}>
            <p style={{ fontSize: 13, marginTop: 0 }}>
              Enter the email address on your account and we&apos;ll send you a link to reset your
              password.
            </p>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="form-actions">
              <button className="btn" type="submit" disabled={pending}>
                {pending ? "Sending…" : "Send Reset Link"}
              </button>
            </div>
          </form>
        )}

        <div className="auth-switch">
          <Link href="/sign-in">Back to Sign In</Link>
        </div>
      </div>
    </div>
  );
}
