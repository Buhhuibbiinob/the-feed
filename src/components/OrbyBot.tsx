"use client";

import { useState } from "react";
import { askOrby } from "@/app/actions/orby";
import { ORBY_DAILY_LIMIT as DAILY_LIMIT } from "@/lib/orby";

type OrbyMessage = { from: "user" | "orby"; text: string };

const GREETING: OrbyMessage = {
  from: "orby",
  text: "Hi, I'm Orby! Ask me for a recommendation - music, a movie, a show, or an underground artist - and I'll find one for you. I only do recommendations, so that's the only thing I'll answer! You get 3 wishes a day, so make them count.",
};

// wishesLeft is null for signed-out visitors: they can see what Orby is, but
// there's no personal count to show until there's an account behind it.
export function OrbyBot({ wishesLeft: initialWishes = null }: { wishesLeft?: number | null }) {
  const [messages, setMessages] = useState<OrbyMessage[]>([GREETING]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [wishesLeft, setWishesLeft] = useState<number | null>(initialWishes);

  const spent = wishesLeft !== null && wishesLeft <= 0;

  async function send() {
    const text = draft.trim();
    if (!text || pending || spent) return;
    setDraft("");
    setMessages((prev) => [...prev, { from: "user", text }]);
    setPending(true);
    const reply = await askOrby(text);
    setPending(false);
    setMessages((prev) => [...prev, { from: "orby", text: reply.text }]);
    setWishesLeft(reply.wishesLeft);
  }

  return (
    <div className="panel orby-panel">
      <div className="panel-head orby-head">
        <span className="orby-head-name">
          <span className="orb orby-head-orb" />
          Orby
        </span>
        {wishesLeft !== null && (
          <span className={`orby-wishes ${spent ? "spent" : ""}`}>
            <span className="orby-wish-dots" aria-hidden="true">
              {Array.from({ length: DAILY_LIMIT }, (_, i) => (
                <span key={i} className={`orby-wish-dot ${i < wishesLeft ? "on" : ""}`} />
              ))}
            </span>
            {wishesLeft} of {DAILY_LIMIT} wishes left today
          </span>
        )}
      </div>
      <div className="chat-body">
        {messages.map((m, i) => (
          <div className="chat-row" key={i}>
            <b>{m.from === "orby" ? "Orby" : "You"}:</b> {m.text}
          </div>
        ))}
        {pending && (
          <div className="chat-row">
            <b>Orby:</b> Thinking…
          </div>
        )}
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          type="text"
          placeholder={spent ? "Out of wishes - back tomorrow" : "Ask Orby for a recommendation…"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={pending || spent}
        />
        <button className="btn" type="submit" disabled={pending || spent}>
          Ask
        </button>
      </form>
      {spent && (
        <div className="orby-refill">Your 3 wishes refill tomorrow.</div>
      )}
    </div>
  );
}
