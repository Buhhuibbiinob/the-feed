"use client";

import { useState } from "react";
import Link from "next/link";
import { coverGradient } from "@/lib/cover";
import { Stars } from "@/components/Stars";

export type ShelfItem = {
  id: string;
  title: string;
  subtitle: string;
  poster?: boolean;
  imageUrl?: string;
  href?: string;
  rating?: number | null;
};

// A pile of DVD cases lying flat, stacked one on top of the other and seen
// edge-on - each case is a horizontal spine bar with the full cover art as
// its background and the title centered on top, like a real stack of DVDs.
function DvdCaseShelf({ items }: { items: ShelfItem[] }) {
  return (
    <div className="sk-dvd-stack">
      {items.map((item) => {
        const image = item.imageUrl ? `url(${item.imageUrl})` : coverGradient(item.id);
        const imageStyle = item.imageUrl
          ? { backgroundImage: image, backgroundSize: "cover", backgroundPosition: "center" }
          : { backgroundImage: image };
        const inner = (
          <>
            <div className="sk-dvd-title">{item.title}</div>
            {item.rating ? <div className="sk-dvd-rating"><Stars rating={item.rating} /></div> : null}
          </>
        );
        return item.href ? (
          <Link href={item.href} className="sk-dvd-spine-case" style={imageStyle} key={item.id} title={`${item.title} - ${item.subtitle}`}>
            {inner}
          </Link>
        ) : (
          <div className="sk-dvd-spine-case" style={imageStyle} key={item.id} title={`${item.title} - ${item.subtitle}`}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

export function Shelf({
  title,
  items,
  emptyMessage = "Nothing here yet - be the first to post one.",
  tone,
}: {
  title: string;
  items: ShelfItem[];
  emptyMessage?: string;
  tone?: "blue" | "purple" | "green" | "pink" | "orange" | "yellow";
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const isDvdShelf = items.length > 0 && items.every((i) => i.poster);

  return (
    <div className={`panel${tone ? ` tone-${tone}` : ""}`}>
      <div className="panel-head tabbed">
        <span className="panel-head-tab">
          <span className="tab-the">the</span>
          <span className="tab-main">{title}</span>
        </span>
      </div>
      <div className="shelf-body">
        {items.length === 0 ? (
          <div className="empty-state">{emptyMessage}</div>
        ) : isDvdShelf ? (
          <DvdCaseShelf items={items} />
        ) : (
          <div className="sk-shelf-grid">
            {items.map((item) => {
              const image = item.imageUrl ? `url(${item.imageUrl})` : coverGradient(item.id);
              const imageStyle = item.imageUrl
                ? { backgroundImage: image, backgroundSize: "cover", backgroundPosition: "center" }
                : { backgroundImage: image };
              const open = openId === item.id;
              return (
                <div className="sk-shelf-item" key={item.id}>
                  <div
                    className="sk-stack"
                    onClick={() => setOpenId(open ? null : item.id)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${item.title} - ${item.subtitle}`}
                  >
                    <div className="sk-stack-sheet sheet-1" />
                    <div className="sk-stack-sheet sheet-2" />
                    <div className="sk-card" style={imageStyle} />
                    {open && (
                      <div className="sk-stack-label">
                        <b>{item.title}</b>
                        <span>{item.subtitle}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
