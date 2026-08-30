"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PostForm } from "@/components/PostForm";

/**
 * Posting as a sheet that rises from the bottom, per the Tweet-compose
 * reference, rather than a page you navigate away to.
 *
 * The point isn't the animation - it's that you don't lose your place.
 * Posting from halfway down the feed used to mean leaving the feed and
 * coming back to the top of it. A sheet keeps the page underneath.
 *
 * Progressive enhancement, deliberately: /post/new is still a real page,
 * and the buttons that open this are still ordinary links to it. The
 * sheet intercepts the click only once this component has mounted, so
 * with scripting off, or before hydration, the link simply navigates.
 * Nobody loses the ability to post because an enhancement didn't load.
 *
 * Escape closes it, the backdrop closes it, and the body is locked
 * while it's open so the feed behind doesn't scroll under your finger.
 */
export function ComposeSheet() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    function onClose() {
      setOpen(false);
    }
    window.addEventListener("compose:open", onOpen);
    window.addEventListener("compose:close", onClose);
    return () => {
      window.removeEventListener("compose:open", onOpen);
      window.removeEventListener("compose:close", onClose);
    };
  }, []);

  // The sheet lives in the layout, so it survives navigation - which
  // means a link followed from inside it used to load the new page
  // underneath and leave the sheet sitting on top of it. Closing when the
  // path changes covers every link in here, including ones added later
  // that never think about the sheet.
  //
  // Compared during render rather than from an effect, the same way the
  // pickers close themselves on success: an effect here would commit the
  // open sheet over the new page first and close it on a second pass.
  const [pathWhenOpened, setPathWhenOpened] = useState(pathname);
  if (pathWhenOpened !== pathname) {
    setPathWhenOpened(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="sheet-backdrop"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Post a review"
    >
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        {/* Cancel left, title centre, action right - the bar every iOS
            modal has, and the only way out that doesn't need a gesture. */}
        <div className="sheet-bar">
          <button type="button" className="acct-btn" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <span className="sheet-title">New Post</span>
          {/* The form owns its own submit button; this keeps the bar
              symmetrical without a second control that could disagree
              with it about whether the form is valid. */}
          <span className="sheet-bar-spacer" aria-hidden="true" />
        </div>
        <div className="sheet-body">
          <PostForm />
        </div>
      </div>
    </div>
  );
}

/** Opens the sheet if it's mounted; returns false if it isn't, so the
 *  caller can let the link navigate to /post/new instead. */
export function openComposeSheet(): boolean {
  if (typeof window === "undefined") return false;
  window.dispatchEvent(new CustomEvent("compose:open"));
  return true;
}

/** Closes it. A no-op on /post/new, where there is no sheet to close. */
export function closeComposeSheet(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("compose:close"));
}
