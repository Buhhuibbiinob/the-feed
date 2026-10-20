"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import "./store.css";

// The three days before the record store opens, across the top of the feed.
//
// The clock counts down against the SERVER's time, not this browser's:
// the page passes the server's "now" and the difference is kept as an
// offset, so a device whose clock is wrong still shows the right number.
// And it is only a display. When it reaches zero it asks the server for
// the page again, and the server decides from its own clock whether the
// store is open - winding a phone's clock forward changes the digits here
// and nothing else.

const TOTAL_MS = 3 * 86_400_000;

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
  const filled = Math.round(Math.min(1, Math.max(0, 1 - left / TOTAL_MS)) * 20);
  const opens = new Date(target).toLocaleString(undefined, {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <section className="ps2-countdown" aria-labelledby="ps2-countdown-title">
      <div className="ps2-pillars" aria-hidden="true">
        {[8, 22, 37, 55, 71, 88].map((x, i) => (
          <i key={x} style={{ left: `${x}%`, animationDelay: `${-i * 1.6}s` }} />
        ))}
      </div>
      <div className="inner">
        <span className="kicker">Now loading</span>
        <h2 id="ps2-countdown-title">The Record Store</h2>
        <div className="clock" role="timer" aria-live="off">
          {(
            [
              ["days", "DAYS"],
              ["hours", "HRS"],
              ["minutes", "MIN"],
              ["seconds", "SEC"],
            ] as const
          ).map(([k, label]) => (
            <span className="unit" key={k}>
              <span className={`digit${k === "seconds" ? " tick" : ""}`} key={k === "seconds" ? p.seconds : undefined}>
                {pad(p[k])}
              </span>
              <small>{label}</small>
            </span>
          ))}
        </div>
        <div className="ps2-segbar" aria-hidden="true">
          {Array.from({ length: 20 }, (_, i) => (
            <i key={i} className={i < filled ? "on" : ""} />
          ))}
        </div>
        <span className="when">
          {left > 0 ? `Doors open ${opens} UTC · five pick-ups a day` : "Opening the doors..."}
        </span>
        <span className="ps2-sr">
          The record store opens in {p.days} days, {p.hours} hours and {p.minutes} minutes.
        </span>
      </div>
    </section>
  );
}
