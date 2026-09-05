"use client";

import { useEffect, useState } from "react";
import { moduleLabel, type ModuleId } from "@/lib/pageConfig";

// The Source column, from the iTunes Music Store.
//
// The reference's left column is a list of places in the store, with the
// one you are looking at highlighted. A profile already is that: an
// ordered list of sections, each one rendered with its module id as its
// DOM id. So this needs no new data - it reads the same order the page
// was built from and points at anchors that already exist.
//
// It is the only part of the store layout that adds behaviour rather
// than chrome, and the behaviour is deliberately small: click to go
// there, and show where "there" currently is.

const ICONS: Record<string, string> = {
  reviews: "♫",
  highlights: "★",
  collections: "▦",
  guestbook: "✎",
  obsessed: "♥",
  repeat: "↻",
  twin: "◑",
  trophies: "♛",
  favorites: "♡",
  queue: "▶",
  clubs: "◈",
  stats: "≡",
};

export function ProfileSourceList({ sections }: { sections: ModuleId[] }) {
  const [active, setActive] = useState<ModuleId | null>(sections[0] ?? null);

  useEffect(() => {
    if (sections.length === 0) return;
    const nodes = sections
      .map((id) => document.getElementById(id))
      .filter((n): n is HTMLElement => !!n);
    if (nodes.length === 0) return;

    // "Which section am I looking at" is the topmost one that has
    // crossed the top of the window - not the one with the largest
    // visible area, which flickers between two neighbours when a short
    // panel sits next to a tall one.
    function pick() {
      let current = nodes[0].id;
      for (const node of nodes) {
        if (node.getBoundingClientRect().top <= 120) current = node.id;
        else break;
      }
      setActive(current);
    }
    pick();
    window.addEventListener("scroll", pick, { passive: true });
    window.addEventListener("resize", pick);
    return () => {
      window.removeEventListener("scroll", pick);
      window.removeEventListener("resize", pick);
    };
  }, [sections]);

  if (sections.length === 0) return null;

  return (
    <nav className="itunes-source" aria-label="Sections">
      <div className="itunes-source-head">Source</div>
      <ul className="itunes-source-list">
        {sections.map((id) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className={`itunes-source-row${active === id ? " active" : ""}`}
              onClick={(e) => {
                const target = document.getElementById(id);
                if (!target) return;
                e.preventDefault();
                target.scrollIntoView({ behavior: "smooth", block: "start" });
                setActive(id);
                // The hash is still worth setting - it is what makes a
                // section linkable - but after the scroll, so the
                // browser's own jump doesn't fight the smooth one.
                window.history.replaceState(null, "", `#${id}`);
              }}
            >
              <span className="itunes-source-icon" aria-hidden="true">
                {ICONS[id] ?? "●"}
              </span>
              <span className="itunes-source-label">{moduleLabel(id)}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
