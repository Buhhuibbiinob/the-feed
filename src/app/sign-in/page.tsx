"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signIn, signInWithMagicLink, type AuthFormState } from "@/app/actions/auth";

const initialState: AuthFormState = {};

export default function SignInPage() {
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [passwordState, passwordAction, passwordPending] = useActionState(
    signIn,
    initialState
  );
  const [magicState, magicAction, magicPending] = useActionState(
    signInWithMagicLink,
    initialState
  );

  const state = mode === "password" ? passwordState : magicState;

  return (
    <div className="auth-card panel">
      <div className="panel-head">Sign In</div>
      <div className="panel-body">
        {state.error && (
          <div className="form-error">
            {state.error}
            {state.hint === "no-account" && (
              <>
                {" "}
                <Link href="/sign-up">Create an account</Link>.
              </>
            )}
          </div>
        )}
        {state.message && <div className="form-message">{state.message}</div>}

        {mode === "password" ? (
          <form action={passwordAction}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            <div className="form-actions">
              <button className="btn" type="submit" disabled={passwordPending}>
                {passwordPending ? "Signing in…" : "Sign In"}
              </button>
              <button
                type="button"
                className="btn-link"
                onClick={() => setMode("magic")}
              >
                Use a magic link instead
              </button>
            </div>
          </form>
        ) : (
          <form action={magicAction}>
            <div className="field">
              <label htmlFor="magic-email">Email</label>
              <input id="magic-email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="form-actions">
              <button className="btn" type="submit" disabled={magicPending}>
                {magicPending ? "Sending…" : "Send Magic Link"}
              </button>
              <button
                type="button"
                className="btn-link"
                onClick={() => setMode("password")}
              >
                Use a password instead
              </button>
            </div>
          </form>
        )}

        <div className="auth-switch">
          Don&apos;t have an account? <Link href="/sign-up">Create one</Link>
        </div>
      </div>
    </div>
  );
}
