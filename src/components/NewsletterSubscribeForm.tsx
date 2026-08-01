"use client";

import { useActionState } from "react";
import { joinWaitlist } from "@/app/actions/waitlist";
import type { AuthFormState } from "@/app/actions/auth";

const initialState: AuthFormState = {};

export function NewsletterSubscribeForm() {
  const [state, formAction, pending] = useActionState(joinWaitlist, initialState);

  return (
    <div>
      {state.error && <div className="form-error">{state.error}</div>}
      {state.message && <div className="form-message">{state.message}</div>}
      <form action={formAction} className="waitlist-form">
        <input name="email" type="email" placeholder="you@example.com" required aria-label="Email address" />
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Joining..." : "Subscribe"}
        </button>
      </form>
    </div>
  );
}
