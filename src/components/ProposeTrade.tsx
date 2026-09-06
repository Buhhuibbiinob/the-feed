"use client";

import { useActionState, useState } from "react";
import { proposeTrade, type TradeState } from "@/app/actions/trades";
import { MAX_TRADE_NOTE, type Offer } from "@/lib/trades";

const initial: TradeState = {};

/**
 * Asking for somebody's record.
 *
 * Opens rather than submits, because a trade has a second half: you have
 * to say which of yours goes the other way. A one press "want it" button
 * would be a wish list, and a wish list is the thing this deliberately
 * is not.
 */
export function ProposeTrade({ offer, mine }: { offer: Offer; mine: Offer[] }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(proposeTrade, initial);

  // Closed by comparing against the previous result during render, the
  // same way the profile pickers and the handover do it.
  const [lastOk, setLastOk] = useState(state.ok);
  if (lastOk !== state.ok) {
    setLastOk(state.ok);
    if (state.ok) {
      setOpen(false);
      setPicked(null);
    }
  }

  if (mine.length === 0) {
    return <span className="wood-quiet">Put one up to trade</span>;
  }

  if (!open) {
    return (
      <button type="button" className="wood-link" onClick={() => setOpen(true)}>
        Offer a swap
      </button>
    );
  }

  return (
    <form action={formAction} className="trade-form">
      <input type="hidden" name="wants_offer_id" value={offer.id} />
      <input type="hidden" name="gives_offer_id" value={picked ?? ""} />

      <div className="trade-mine">
        {mine.map((own) => (
          <button
            key={own.id}
            type="button"
            className={`trade-pick${picked === own.id ? " picked" : ""}`}
            aria-pressed={picked === own.id}
            onClick={() => setPicked(picked === own.id ? null : own.id)}
          >
            {own.title}
          </button>
        ))}
      </div>

      <input
        type="text"
        name="note"
        maxLength={MAX_TRADE_NOTE}
        placeholder="Say why, if you like"
        className="trade-note-input"
      />

      {state.error && <div className="form-error">{state.error}</div>}

      <div className="trade-form-actions">
        <button type="submit" className="btn" disabled={pending || !picked}>
          {pending ? "Asking" : "Ask them"}
        </button>
        <button type="button" className="wood-link" onClick={() => setOpen(false)}>
          Never mind
        </button>
      </div>
    </form>
  );
}
