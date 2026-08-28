"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Pull down at the top of the page to reload the feed.
 *
 * Only ever engages when the page is already scrolled to the very top
 * and the gesture is clearly vertical - otherwise a horizontal swipe
 * through a shelf, or a normal scroll that happens to begin at zero,
 * would start dragging the whole page. That misfire is the reason most
 * web versions of this feel broken, so both conditions are checked
 * before the first pixel of movement is accepted.
 *
 * Touch only. There is no pull-to-refresh with a mouse, and wiring one
 * to a wheel event would fight the browser's own overscroll.
 */
const THRESHOLD = 64;
const MAX = 96;

export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<{ y: number; x: number } | null>(null);
  const active = useRef(false);
  const router = useRouter();

  useEffect(() => {
    function onStart(e: TouchEvent) {
      if (busy || window.scrollY > 0 || e.touches.length !== 1) return;
      start.current = { y: e.touches[0].clientY, x: e.touches[0].clientX };
      active.current = false;
    }
    function onMove(e: TouchEvent) {
      const s = start.current;
      if (!s || busy) return;
      const dy = e.touches[0].clientY - s.y;
      const dx = e.touches[0].clientX - s.x;
      if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) {
        start.current = null;
        return;
      }
      // Past this point the gesture is ours.
      active.current = true;
      // Resistance, so it feels attached to something rather than free.
      setPull(Math.min(MAX, dy * 0.45));
    }
    function onEnd() {
      if (!start.current || !active.current) {
        start.current = null;
        setPull(0);
        return;
      }
      start.current = null;
      active.current = false;
      setPull((current) => {
        if (current >= THRESHOLD * 0.45) {
          setBusy(true);
          router.refresh();
          window.setTimeout(() => {
            setBusy(false);
            setPull(0);
          }, 650);
          return THRESHOLD * 0.45;
        }
        return 0;
      });
    }

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [busy, router]);

  if (pull === 0 && !busy) return null;

  const ready = pull >= THRESHOLD * 0.45;
  return (
    <div className="ptr" style={{ height: pull }} aria-hidden="true">
      <span className={`ptr-spinner${busy ? " spinning" : ""}`} />
      <span className="ptr-label">{busy ? "Refreshing" : ready ? "Release to refresh" : "Pull to refresh"}</span>
    </div>
  );
}
