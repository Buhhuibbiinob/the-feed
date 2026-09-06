"use client";

import { useActionState } from "react";
import { offerRecord, type TradeState } from "@/app/actions/trades";
import { MAX_TRADE_NOTE } from "@/lib/trades";

const initial: TradeState = {};

/**
 * Putting a record on the table.
 *
 * Typed rather than picked off your shelf, and that is the privacy
 * decision rather than a shortcut. Offering a chooser of everything you
 * have queued would mean rendering your whole shelf into a page about
 * showing things to other people, and the shelf is private. Typing the
 * one you mean keeps it that way.
 */
export function OfferPicker() {
  const [state, formAction, pending] = useActionState(offerRecord, initial);

  return (
    <form action={formAction} className="offer-form">
      <div className="offer-fields">
        <label className="sr-only" htmlFor="offer-title">
          Record
        </label>
        <input id="offer-title" name="title" placeholder="Which record" required maxLength={200} />
        <label className="sr-only" htmlFor="offer-artist">
          Artist
        </label>
        <input id="offer-artist" name="artist" placeholder="Who by" maxLength={200} />
      </div>
      <label className="sr-only" htmlFor="offer-note">
        Why you are parting with it
      </label>
      <input
        id="offer-note"
        name="note"
        maxLength={MAX_TRADE_NOTE}
        placeholder="Why are you parting with it? Optional."
      />
      {state.error && <div className="form-error">{state.error}</div>}
      {state.ok && <div className="form-message">On the table.</div>}
      <button type="submit" className="btn" disabled={pending}>
        {pending ? "Putting it up" : "Put it on the table"}
      </button>
    </form>
  );
}
