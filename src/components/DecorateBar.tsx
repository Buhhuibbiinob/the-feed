"use client";

import { useSyncExternalStore } from "react";
import { Portal } from "@/components/Portal";
import {
  decorateServerSnapshot,
  isDecorating,
  setDecorating,
  subscribeDecorate,
} from "@/lib/decorate";

/**
 * The one control that puts the page into decorating mode.
 *
 * Sits fixed at the bottom of the screen, out of the way of the content
 * but always reachable - the point of decorating is that you fiddle
 * with it while looking at the whole page.
 *
 * Rendered through a portal to <body>, and that is load-bearing rather
 * than tidiness. The page transition animates a transform on the
 * wrapper every route change, and an element with any transform other
 * than `none` becomes the containing block for its fixed descendants.
 * So `position: fixed` inside a page anchors to the top of that page,
 * not the viewport: the bar sat at the very bottom of a long profile
 * and you had to scroll the whole way down to reach it, which is
 * exactly what it looked like.
 *
 * The portal puts it outside the transformed subtree, which is also how
 * a real app is built - the toolbar does not slide away with the
 * content it is acting on.
 */
export function DecorateBar({ isOwner }: { isOwner: boolean }) {
  const on = useSyncExternalStore(subscribeDecorate, isDecorating, decorateServerSnapshot);
  if (!isOwner) return null;

  return (
    <Portal>
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
    </Portal>
  );
}
