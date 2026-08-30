"use client";

import { useActionState } from "react";
import { adminBackfillWorks, type BackfillState } from "@/app/actions/admin";

const initialState: BackfillState = {};

/**
 * Runs the works backfill from the admin page.
 *
 * The endpoint version needs an Authorization header, which a browser
 * cannot send by typing a URL - so without this the only way to run it
 * was curl with a bearer token, which is a silly thing to require of the
 * person who owns the site.
 */
export function BackfillWorksButton() {
  const [state, formAction, pending] = useActionState(
    async () => adminBackfillWorks(),
    initialState
  );

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}
      {state.result && (
        <div className="form-message">
          Linked {state.result.linked} review{state.result.linked === 1 ? "" : "s"}.
          {state.result.skipped
            ? ` ${state.result.skipped} had no usable title and were left alone.`
            : ""}
          {state.result.remaining
            ? ` ${state.result.remaining} still to do - run it again.`
            : " Nothing left to link."}
          {state.result.errors.length > 0 && ` ${state.result.errors.length} failed.`}
        </div>
      )}
      <p className="field-hint" style={{ marginTop: 0 }}>
        Reviews posted before works existed have no work to belong to, so they don&apos;t appear on
        a work&apos;s page or count towards its average. This links them. Safe to run more than once.
      </p>
      <div className="form-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Linking…" : "Link old reviews to their works"}
        </button>
      </div>
    </form>
  );
}
