"use client";

import { useRef, useState } from "react";

/**
 * Swipe a row left to reveal Delete, as in Mail and Messages.
 *
 * Pointer events rather than touch events, so a trackpad drag works
 * too; and the horizontal/vertical decision is made once, on the first
 * few pixels, then locked. Without that lock a diagonal scroll makes
 * the row creep sideways the whole way down the list - the single most
 * common way this gesture is got wrong.
 *
 * The row still contains a real form, so Delete works with the gesture
 * unavailable: keyboard, screen reader, or a browser where pointer
 * capture fails. The swipe reveals the button, it does not replace it.
 */
const REVEAL = 76;

export function SwipeRow({
  children,
  action,
  label = "Delete",
}: {
  children: React.ReactNode;
  /** Rendered when the row is open. Usually a form with a submit button. */
  action: React.ReactNode;
  label?: string;
}) {
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const axis = useRef<"none" | "x" | "y">("none");

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    axis.current = "none";
  }

  function onPointerMove(e: React.PointerEvent) {
    if (axis.current === "y") return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (axis.current === "none") {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (axis.current === "y") return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    const base = open ? -REVEAL : 0;
    setOffset(Math.max(-REVEAL, Math.min(0, base + dx)));
  }

  function onPointerUp() {
    if (axis.current !== "x") {
      axis.current = "none";
      return;
    }
    axis.current = "none";
    const shouldOpen = offset < -REVEAL / 2;
    setOpen(shouldOpen);
    setOffset(shouldOpen ? -REVEAL : 0);
  }

  return (
    <div className="swipe-row">
      <div className="swipe-row-action" aria-hidden={!open}>
        {action}
      </div>
      <div
        className="swipe-row-face"
        style={{ transform: `translate3d(${offset}px, 0, 0)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {children}
      </div>
      {open && (
        <button
          type="button"
          className="swipe-row-close"
          onClick={() => {
            setOpen(false);
            setOffset(0);
          }}
          aria-label={`Hide ${label}`}
        />
      )}
    </div>
  );
}
