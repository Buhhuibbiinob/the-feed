"use client";

import { useSyncExternalStore } from "react";
import {
  decorateServerSnapshot,
  isDecorating,
  setDecorating,
  subscribeDecorate,
} from "@/lib/decorate";

/**
 * The one control that puts the page into decorating mode.
 *
 * Sits fixed at the bottom of your own profile, out of the way of the
 * content but always reachable - the point of decorating is that you
 * fiddle with it while looking at the whole page, and a button at the
 * top means scrolling back up every time you want to change something.
 */
export function DecorateBar({ isOwner }: { isOwner: boolean }) {
  const on = useSyncExternalStore(subscribeDecorate, isDecorating, decorateServerSnapshot);
  if (!isOwner) return null;

  return (
    <div className={`decorate-bar${on ? " on" : ""}`}>
      {on && (
        <span className="decorate-hint">
          Drag panels to move them. Drag stickers anywhere. Everything saves as you go.
        </span>
      )}
      <button
        type="button"
        className={on ? "btn" : "acct-btn"}
        onClick={() => setDecorating(!on)}
      >
        {on ? "Done" : "Decorate"}
      </button>
    </div>
  );
}
