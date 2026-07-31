"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp, type AuthFormState } from "@/app/actions/auth";
import { joinWaitlist } from "@/app/actions/waitlist";

const initialState: AuthFormState = {};

function thirteenYearsAgo() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 13);
  return d.toISOString().slice(0, 10);
}

export default function SignUpPage() {
  const [state, formAction, pending] = useActionState(signUp, initialState);
  const [waitlistState, waitlistAction, waitlistPending] = useActionState(joinWaitlist, initialState);
  const maxBirthdate = thirteenYearsAgo();

  return (
    <>
      <div className="auth-card panel">
        <div className="panel-head">Create Account</div>
        <div className="panel-body">
          {state.error && <div className="form-error">{state.error}</div>}
          {state.message && <div className="form-message">{state.message}</div>}
          <form action={formAction}>
            <div className="field">
              <label htmlFor="username">Username</label>
              <input id="username" name="username" type="text" required autoComplete="username" />
            </div>
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
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div className="field">
              <label htmlFor="birthdate">Birthdate</label>
              <input
                id="birthdate"
                name="birthdate"
                type="date"
                required
                max={maxBirthdate}
                autoComplete="bday"
              />
            </div>
            <div className="field checkbox-field">
              <label>
                <input type="checkbox" name="terms_accepted" required />{" "}
                I agree to the <Link href="/privacy">Privacy Policy</Link> and{" "}
                <Link href="/terms">Terms of Service</Link>
              </label>
            </div>
            <div className="form-actions">
              <button className="btn" type="submit" disabled={pending}>
                {pending ? "Creating…" : "Create Account"}
              </button>
            </div>
          </form>
          <div className="auth-switch">
            Already have an account? <Link href="/sign-in">Sign in</Link>
          </div>
        </div>
      </div>

      <div className="auth-card panel">
        <div className="panel-head">Not Ready Yet?</div>
        <div className="panel-body">
          <p className="field-hint" style={{ marginBottom: 10 }}>
            Get an email when we ship new features - no account required.
          </p>
          {waitlistState.error && <div className="form-error">{waitlistState.error}</div>}
          {waitlistState.message && <div className="form-message">{waitlistState.message}</div>}
          <form action={waitlistAction} className="waitlist-form">
            <input
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              aria-label="Email address"
            />
            <button className="btn" type="submit" disabled={waitlistPending}>
              {waitlistPending ? "Joining…" : "Get Notified"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
