"use client";

import { useEffect } from "react";
import { playClick, type ClickVariant } from "@/lib/sound";

/**
 * Plays a click when you press something that does something.
 *
 * One delegated listener on the document rather than a handler per
 * control: there are a few hundred interactive elements on this site and
 * wiring each one would mean every future component has to remember to
 * opt in - which is the same as it not working.
 *
 * pointerdown, not click. iOS makes its sound the instant your finger
 * lands, before the action resolves, and that immediacy is most of why
 * it feels responsive. Waiting for click puts the sound after the
 * navigation has already started.
 *
 * Deliberately silent on: text fields (typing is not clicking), the
 * sticker canvas and swipe rows (a drag is not a tap), disabled
 * controls, and anything the user is selecting text inside.
 */
const SILENT = [
  "input[type=text]",
  "input[type=search]",
  "input[type=email]",
  "input[type=password]",
  "input[type=url]",
  "input[type=file]",
  "textarea",
  "select",
  ".sticker",
  ".sticker-layer",
  ".swipe-row-face",
];

/** Lower "you moved" click for things that navigate or destroy. */
const TOCK = ["a[href]", ".rail-row", ".dm-inbox-row", ".tl-card", ".back-btn", ".danger"];

const TOGGLE = ["input[type=checkbox]", "input[type=radio]", ".seg-item", ".feed-chip"];

function variantFor(el: Element): ClickVariant | null {
  if (SILENT.some((s) => el.closest(s))) return null;
  if (el.closest("[disabled], [aria-disabled=true]")) return null;
  if (TOGGLE.some((s) => el.closest(s))) return "toggle";
  if (TOCK.some((s) => el.closest(s))) return "tock";
  if (el.closest("button, [role=button], label, input[type=submit]")) return "tick";
  return null;
}

export function ClickSound() {
  useEffect(() => {
    function onDown(e: PointerEvent) {
      // Right-click and middle-click are not taps.
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const target = e.target;
      if (!(target instanceof Element)) return;
      const variant = variantFor(target);
      if (variant) playClick(variant);
    }
    document.addEventListener("pointerdown", onDown, { passive: true });
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  return null;
}
