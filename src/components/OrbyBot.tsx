"use client";

import { useState } from "react";
import { askOrby } from "@/app/actions/orby";

type OrbyMessage = { from: "user" | "orby"; text: string };

const GREETING: OrbyMessage = {
  from: "orby",
  text: "Hi, I'm Orby! Ask me for a recommendation - music, a movie, a show, or an underground artist - and I'll find one for you. I only do recommendations, so that's the only thing I'll answer! You get 3 wishes a day, so make them count.",
};

export function OrbyBot() {
  const [messages, setMessages] = useState<OrbyMessage[]>([GREETING]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);

  async function send() {
    const text = draft.trim();
    if (!text || pending) return;
    setDraft("");
    setMessages((prev) => [...prev, { from: "user", text }]);
    setPending(true);
    const reply = await askOrby(text);
    setPending(false);
    setMessages((prev) => [...prev, { from: "orby", text: reply }]);
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="orb" style={{ width: 18, height: 18, marginRight: 8, verticalAlign: "middle" }} />
        Orby
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
          placeholder="Ask Orby for a recommendation…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={pending}
        />
        <button className="btn" type="submit" disabled={pending}>
          Ask
        </button>
      </form>
    </div>
  );
}
