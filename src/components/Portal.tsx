"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children into <body>, outside the page's transformed wrapper.
 *
 * Not tidiness - correctness. The page transition animates a transform
 * on the wrapper around every page, and an element with any transform
 * other than `none` becomes the containing block for its `position:
 * fixed` descendants. So anything fixed that is authored inside a page
 * anchors to that page instead of the viewport: a bar meant to sit at
 * the bottom of the screen sits at the bottom of the whole document,
 * and a modal backdrop meant to cover the window covers the article.
 *
 * Anything full-screen goes through here.
 */

/** Client-only, and it never changes after hydration - so it is read as
 *  a store rather than set in a mount effect, which would be a
 *  guaranteed second render. */
const subscribeNever = () => () => {};
const onClient = () => true;
const onServer = () => false;

export function Portal({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(subscribeNever, onClient, onServer);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
