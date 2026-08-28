"use client";

import { usePathname } from "next/navigation";

/**
 * Re-runs an enter animation whenever the route changes.
 *
 * The key is the pathname, so React discards the old subtree and mounts a
 * new one on navigation - which is what restarts the CSS animation. A
 * plain wrapper would keep the same element and the animation would only
 * ever play once, on first load.
 *
 * The animation itself is opacity and a 4px rise, both of which are
 * composited. Nothing here animates a property that triggers layout, so a
 * navigation can never reflow the page under someone's thumb mid-tap.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
