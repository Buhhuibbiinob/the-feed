"use client";

import { useEffect, useRef } from "react";
import { coverGradient } from "@/lib/cover";

export type ShelfItem = {
  id: string;
  title: string;
  subtitle: string;
  poster?: boolean;
  imageUrl?: string;
};

export function Shelf({
  title,
  items,
  emptyMessage = "Nothing here yet — be the first to post one.",
}: {
  title: string;
  items: ShelfItem[];
  emptyMessage?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const frameRef = useRef<number | undefined>(undefined);

  function update() {
    const track = trackRef.current;
    if (!track) return;
    const trackRect = track.getBoundingClientRect();
    const centerX = trackRect.left + trackRect.width / 2;

    for (const item of items) {
      const el = itemRefs.current.get(item.id);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const itemCenter = rect.left + rect.width / 2;
      const delta = itemCenter - centerX;
      const norm = Math.max(-1, Math.min(1, delta / (trackRect.width / 2)));
      const side = Math.sign(norm);
      // t tracks actual distance from center (not saturated early) so each
      // item gets a distinct transform — saturating too fast made every
      // near-center item collapse onto the same pose and visually stack.
      const t = Math.abs(norm);
      const rotate = side * -68 * t;
      const scale = 1 - t * 0.3;
      const z = -t * 130;
      const x = -side * t * 92;
      el.style.transform = `perspective(700px) translateX(${x}px) translateZ(${z}px) rotateY(${rotate}deg) scale(${scale})`;
      el.style.zIndex = String(Math.round((1 - t) * 100));
      el.style.opacity = String(1 - t * 0.1);

      const reflect = el.querySelector<HTMLElement>(".cover-reflect");
      if (reflect) {
        // Fade the reflection out fast as an item leaves center so
        // overlapping covers never stack two visible reflections.
        reflect.style.opacity = String(Math.max(0, 0.55 - t * 0.65));
      }

      // Title/subtitle fade out faster than the cover itself so raked,
      // tightly-packed neighbors never overlap the centered item's text.
      const textOpacity = Math.max(0, 1 - Math.abs(norm) * 6);
      const title = el.querySelector<HTMLElement>(".title");
      const sub = el.querySelector<HTMLElement>(".sub");
      if (title) title.style.opacity = String(textOpacity);
      if (sub) sub.style.opacity = String(textOpacity);
    }
  }

  function onScroll() {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(update);
  }

  useEffect(() => {
    update();
    window.addEventListener("resize", onScroll);
    return () => window.removeEventListener("resize", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  function scrollBy(amount: number) {
    trackRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  }

  function focusItem(id: string) {
    const track = trackRef.current;
    const el = itemRefs.current.get(id);
    if (!track || !el) return;
    const trackRect = track.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const delta = rect.left + rect.width / 2 - (trackRect.left + trackRect.width / 2);
    track.scrollBy({ left: delta, behavior: "smooth" });
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <span>{title}</span>
      </div>
      <div className="shelf-body coverflow">
        {items.length > 4 && (
          <div className="shelf-arrow left" onClick={() => scrollBy(-260)}>
            ◀
          </div>
        )}
        <div className="shelf-track coverflow-track" ref={trackRef} onScroll={onScroll}>
          {items.length === 0 ? (
            <div className="empty-state">{emptyMessage}</div>
          ) : (
            <>
              <div className="coverflow-spacer" aria-hidden="true" />
              {items.map((item) => {
                const image = item.imageUrl
                  ? `url(${item.imageUrl})`
                  : coverGradient(item.id);
                const imageStyle = item.imageUrl
                  ? { backgroundImage: image, backgroundSize: "cover", backgroundPosition: "center" }
                  : { backgroundImage: image };
                return (
                  <div
                    className="cover-item coverflow-item"
                    key={item.id}
                    ref={(el) => {
                      if (el) itemRefs.current.set(item.id, el);
                      else itemRefs.current.delete(item.id);
                    }}
                    onClick={() => focusItem(item.id)}
                  >
                    <div className={`cover${item.poster ? " poster" : ""}`} style={imageStyle} />
                    <div
                      className="cover-reflect"
                      style={{ ...imageStyle, height: item.poster ? 46 : undefined }}
                    />
                    <div className="title">{item.title}</div>
                    <div className="sub">{item.subtitle}</div>
                  </div>
                );
              })}
              <div className="coverflow-spacer" aria-hidden="true" />
            </>
          )}
        </div>
        {items.length > 4 && (
          <div className="shelf-arrow right" onClick={() => scrollBy(260)}>
            ▶
          </div>
        )}
      </div>
    </div>
  );
}
