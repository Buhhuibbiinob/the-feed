"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import "./store.css";

// The three days before the record store opens, across the top of the feed.
//
// Styled as a PS2 online-channels menu: violet glass cubes drifting in the
// dark, a lime heading, a list of lavender items with the live one lit up,
// and the controller hints along the bottom. Feedback's own name sits in
// the header, not the console maker's.
//
// The clock counts down against the SERVER's time, not this browser's:
// the page passes the server's "now" and the difference is kept as an
// offset, so a device whose clock is wrong still shows the right number.
// And it is only a display. When it reaches zero it asks the server for
// the page again, and the server decides from its own clock whether the
// store is open - winding a phone's clock forward changes the digits here
// and nothing else.

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(s / 86_400),
    hours: Math.floor((s % 86_400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
const plural = (n: number, one: string) => `${n === 1 ? one : `${one}s`}`;

// Size (px), position (% of the banner), starting tilt and spin speed for
// each cube, scattered to the right of the menu as in the reference.
const CUBES: { s: number; x: number; y: number; rx: number; ry: number; t: number; blur?: boolean }[] = [
  { s: 64, x: 52, y: 10, rx: 24, ry: 38, t: 26 },
  { s: 30, x: 64, y: 30, rx: 40, ry: 12, t: 19, blur: true },
  { s: 54, x: 60, y: 46, rx: 18, ry: 52, t: 31 },
  { s: 72, x: 84, y: 26, rx: 32, ry: 28, t: 23 },
  { s: 26, x: 46, y: 54, rx: 50, ry: 20, t: 17, blur: true },
  { s: 50, x: 74, y: 62, rx: 22, ry: 44, t: 29 },
  { s: 38, x: 82, y: 72, rx: 36, ry: 16, t: 21 },
  { s: 58, x: 54, y: 78, rx: 28, ry: 34, t: 27 },
];

export function StoreCountdown({ launchAt, serverNow }: { launchAt: string; serverNow: string }) {
  const router = useRouter();
  const target = useMemo(() => new Date(launchAt).getTime(), [launchAt]);
  // Server time minus this device's time, measured once at load.
  const [offset] = useState(() => new Date(serverNow).getTime() - Date.now());
  const [now, setNow] = useState(() => new Date(serverNow).getTime());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now() + offset), 1000);
    return () => window.clearInterval(id);
  }, [offset]);

  const left = target - now;
  useEffect(() => {
    if (left > 0) return;
    // A little after zero, so the server's clock has certainly passed it.
    const id = window.setTimeout(() => router.refresh(), 1500);
    return () => window.clearTimeout(id);
  }, [left, router]);

  const p = parts(left);
  const opens = new Date(target).toLocaleString(undefined, {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const items: { key: string; text: string; lit?: boolean; dim?: boolean }[] =
    left > 0
      ? [
          { key: "label", text: "Doors open in", dim: true },
          { key: "d", text: `${pad(p.days)} ${plural(p.days, "Day")}` },
          { key: "h", text: `${pad(p.hours)} ${plural(p.hours, "Hour")}` },
          { key: "m", text: `${pad(p.minutes)} ${plural(p.minutes, "Minute")}` },
          { key: "s", text: `${pad(p.seconds)} ${plural(p.seconds, "Second")}`, lit: true },
          { key: "when", text: `${opens} UTC`, dim: true },
          { key: "rule", text: "Five pick-ups a day", dim: true },
        ]
      : [{ key: "open", text: "Opening the doors...", lit: true }];

  return (
    <section className="ps2-countdown" aria-labelledby="ps2-countdown-title">
      <div className="bb-haze" aria-hidden="true" />
      <div className="bb-cubes" aria-hidden="true">
        {CUBES.map((c, i) => (
          <span
            key={i}
            className={`bb-cube${c.blur ? " far" : ""}`}
            style={
              {
                left: `${c.x}%`,
                top: `${c.y}%`,
                "--s": `${c.s}px`,
                "--rx": `${c.rx}deg`,
                "--ry": `${c.ry}deg`,
                "--t": `${c.t}s`,
                animationDelay: `${-i * 3.1}s`,
              } as React.CSSProperties
            }
          >
            {["f", "b", "l", "r", "u", "d"].map((face) => (
              <i key={face} className={`bb-face ${face}`} />
            ))}
          </span>
        ))}
      </div>

      <header className="bb-bar">
        <span className="bb-mark" aria-hidden="true">
          F
        </span>
        <span className="bb-brand">Feedback</span>
      </header>

      <div className="bb-menu">
        <h2 id="ps2-countdown-title">The Record Store</h2>
        <ul role="timer" aria-live="off">
          {items.map((it) => (
            <li key={it.key} className={it.lit ? "lit" : it.dim ? "dim" : undefined}>
              {it.text}
            </li>
          ))}
        </ul>
      </div>

      <footer className="bb-bar bottom" aria-hidden="true">
        <span>
          <b className="bb-x">✕</b> Feed
        </span>
        <span>
          <b className="bb-o">○</b> Enter at launch
        </span>
      </footer>

      <span className="ps2-sr">
        The record store opens on {opens} UTC, in {p.days} days, {p.hours} hours and {p.minutes} minutes.
      </span>
    </section>
  );
}
