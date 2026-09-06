"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

/**
 * The strip of dividers, scrolled to the one that is open.
 *
 * The Year axis has sixty-odd dividers and the newest come first, so
 * picking 1994 left the strip still showing 2026 and the open divider
 * thirty off the right-hand edge - the page looked like nothing had been
 * chosen. A scroll container cannot be positioned from CSS, and this is
 * the whole reason the strip is a client component.
 */
export function ShelfDividers({
  axis,
  values,
  open,
  labelFor,
}: {
  axis: string;
  values: readonly string[];
  open: string | null;
  labelFor: (value: string) => string;
}) {
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const current = stripRef.current?.querySelector<HTMLElement>(".shelf-divider.open");
    if (!current) return;
    // Centred, so the dividers either side are visible too - browsing a
    // year is mostly about the years next to it.
    //
    // block:"nearest" is load-bearing. Without it this also scrolls the
    // PAGE to bring the strip into view, which on arrival jumps straight
    // past the heading you just clicked through to.
    current.scrollIntoView({ block: "nearest", inline: "center" });
  }, [open]);

  return (
    <div className="shelf-dividers" ref={stripRef}>
      {values.map((value) => (
        <Link
          key={value}
          href={`/shelves?axis=${axis}&value=${encodeURIComponent(value)}`}
          className={`shelf-divider${value === open ? " open" : ""}`}
        >
          {labelFor(value)}
        </Link>
      ))}
    </div>
  );
}
