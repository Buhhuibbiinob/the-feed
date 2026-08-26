"use client";

import { useRef, useState } from "react";

/**
 * The secondary widgets, below the fold, as a swipeable rail instead of a
 * vertical stack.
 *
 * Scroll position drives the dots rather than the other way round, so
 * dragging the rail and pressing a dot stay in agreement - a carousel
 * that tracks its own index separately drifts the moment someone flicks
 * it by hand.
 */
export function WidgetCarousel({
  items,
}: {
  items: { key: string; node: React.ReactNode }[];
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  if (items.length === 0) return null;

  function onScroll() {
    const rail = railRef.current;
    if (!rail) return;
    const width = rail.clientWidth;
    if (width === 0) return;
    setIndex(Math.round(rail.scrollLeft / width));
  }

  function go(next: number) {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollTo({ left: next * rail.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="widget-carousel">
      <div className="widget-rail" ref={railRef} onScroll={onScroll}>
        {items.map((item) => (
          <div className="widget-slide" key={item.key}>
            {item.node}
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <div className="widget-dots">
          {items.map((item, i) => (
            <button
              type="button"
              key={item.key}
              className={`widget-dot${i === index ? " active" : ""}`}
              onClick={() => go(i)}
              aria-label={`Show panel ${i + 1} of ${items.length}`}
              aria-current={i === index}
            />
          ))}
        </div>
      )}
    </div>
  );
}
