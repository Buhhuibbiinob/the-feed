"use client";

import { useState } from "react";
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
  emptyMessage = "Nothing here yet - be the first to post one.",
  tone,
}: {
  title: string;
  items: ShelfItem[];
  emptyMessage?: string;
  tone?: "blue" | "purple" | "green" | "pink" | "orange" | "yellow";
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className={`panel${tone ? ` tone-${tone}` : ""}`}>
      <div className="panel-head tabbed">
        <span className="panel-head-tab">
          <span className="tab-the">the</span>
          <span className="tab-main">{title}</span>
        </span>
      </div>
      <div className="shelf-body">
        <div className="sk-shelf-grid">
          {items.length === 0 ? (
            <div className="empty-state">{emptyMessage}</div>
          ) : (
            items.map((item) => {
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
                    <div className={`sk-card${item.poster ? " poster" : ""}`} style={imageStyle} />
                    {open && (
                      <div className="sk-stack-label">
                        <b>{item.title}</b>
                        <span>{item.subtitle}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
