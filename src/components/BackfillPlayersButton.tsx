"use client";

import { useActionState } from "react";
import { adminBackfillPlayers, type PlayerBackfillState } from "@/app/actions/admin";

const initialState: PlayerBackfillState = {};

/**
 * Gives the reviews already written the player they never got.
 *
 * A button rather than something automatic, because every review it
 * fixes costs a YouTube search out of a ten-thousand-unit day - a feed
 * doing this on its own would spend the lot on one page view. Ten at a
 * time, and it says how many are left so the cost of finishing is
 * visible before it is spent.
 */
export function BackfillPlayersButton() {
  const [state, formAction, pending] = useActionState(
    async () => adminBackfillPlayers(),
    initialState
  );

  return (
    <form action={formAction}>
      {state.error && <div className="form-error">{state.error}</div>}
      {state.result && (
        <div className="form-message">
          Looked at {state.result.looked} review{state.result.looked === 1 ? "" : "s"}:{" "}
          {state.result.videos} got a video, {state.result.spotify} got a Spotify player,{" "}
          {state.result.covers} got a cover.
          {state.result.remaining
            ? ` ${state.result.remaining} still have no player: run it again.`
            : " Every review has one now."}
        </div>
      )}
      <p className="field-hint" style={{ marginTop: 0 }}>
        Reviews written before the site looked a video up for them have nothing to play. This finds
        one for ten of them, newest first, and falls back to Spotify when YouTube&apos;s daily
        allowance is spent. Each one costs a YouTube search, so it goes ten at a time on purpose.
      </p>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Finding players…" : "Give ten reviews their player"}
      </button>
    </form>
  );
}
