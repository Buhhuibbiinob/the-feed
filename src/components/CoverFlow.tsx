"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PROVIDER_LABELS, embedUrl, openUrl, type Playlist } from "@/lib/playlists";

/**
 * Cover Flow.
 *
 * The iPod's answer to a list, and the reason it is worth copying is
 * that it was never decoration: a list of forty playlists is forty rows
 * of text you read, and Cover Flow is one cover you are looking AT with
 * the next two waiting at an angle. It turns a directory into a thing
 * you flick through, which is the same argument the crate and the rack
 * make one floor down.
 *
 * Everything is on one axis. The covers do not scroll - the deck rotates
 * around whichever one is in front, and each neighbour is pushed sideways
 * and turned away from you a little more. Three deep on each side, which
 * is where the real one stopped too: past that a cover is a sliver, and
 * paying to lay out a sliver is paying for nothing.
 *
 * The player only appears for the one in front, and only when asked. An
 * iframe per playlist would be forty embeds on a page, which is forty
 * third-party players all loading at once, and the tab would take a
 * minute to settle.
 */

/** How many covers stand behind the front one on each side. */
const DEPTH = 3;

export function CoverFlow({ playlists }: { playlists: Playlist[] }) {
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  const count = playlists.length;
  const go = useCallback(
    (next: number) => {
      if (count === 0) return;
      const clamped = Math.max(0, Math.min(count - 1, next));
      setAt(clamped);
      // Moving to a different playlist stops the one that was playing.
      // Two players at once on a page about listening to one thing is
      // the thing that must not happen.
      setPlaying(false);
    },
    [count]
  );

  // Arrow keys, because a deck you flick through with a keyboard is the
  // whole point of it being a deck.
  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setAt((n) => Math.max(0, n - 1));
        setPlaying(false);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setAt((n) => Math.min(count - 1, n + 1));
        setPlaying(false);
      }
    }
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [count]);

  // A swipe on a phone. Horizontal only, and only past a threshold, so
  // scrolling the page down does not shuffle the deck on the way.
  const touch = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    go(at + (dx < 0 ? 1 : -1));
  }

  if (count === 0) return null;
  const current = playlists[at];

  return (
    <div className="cflow">
      <div
        className="cflow-deck"
        ref={railRef}
        tabIndex={0}
        role="listbox"
        aria-label="Playlists"
        aria-activedescendant={`cflow-${current.id}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {playlists.map((playlist, i) => {
          const offset = i - at;
          // Anything past the depth is not laid out at all. It stays in
          // the DOM for the screen reader and for the count, but it does
          // not get a transform or a shadow to composite.
          if (Math.abs(offset) > DEPTH) return null;
          const side = Math.sign(offset);
          const depth = Math.abs(offset);
          return (
            <button
              key={playlist.id}
              id={`cflow-${playlist.id}`}
              type="button"
              role="option"
              aria-selected={offset === 0}
              className={`cflow-cover${offset === 0 ? " front" : ""}`}
              style={{
                // One transform, composited: slide sideways, push back,
                // and turn away from the front. The front cover has no
                // rotation at all, which is what makes it read as the
                // one being looked at rather than the biggest one.
                ["--side" as string]: side,
                ["--depth" as string]: depth,
                // The reflection reuses the picture the browser has
                // already fetched, so the mirror costs no second
                // request and no second element.
                ...(playlist.coverUrl
                  ? { ["--reflect" as string]: `url(${playlist.coverUrl})` }
                  : {}),
                zIndex: DEPTH - depth,
              }}
              onClick={() => (offset === 0 ? setPlaying((p) => !p) : go(i))}
              aria-label={
                offset === 0
                  ? `${playing ? "Hide" : "Play"} ${playlist.title}`
                  : `Go to ${playlist.title}`
              }
            >
              {playlist.coverUrl ? (
                <img src={playlist.coverUrl} alt="" loading="lazy" decoding="async" />
              ) : (
                // A playlist whose service gave us no picture. The same
                // printed board and paper label a record with no cover
                // gets everywhere else here, rather than a grey hole.
                <span className="cflow-blank" aria-hidden="true">
                  {playlist.title.slice(0, 1).toUpperCase()}
                </span>
              )}
              {/* The reflection. Cover Flow without the floor under it is
                  just covers at an angle. */}
              <span className="cflow-shine" aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <div className="cflow-nav">
        <button
          type="button"
          className="cflow-arrow"
          onClick={() => go(at - 1)}
          disabled={at === 0}
          aria-label="Previous playlist"
        >
          ‹
        </button>
        <div className="cflow-label">
          <b>{current.title}</b>
          <span>
            {PROVIDER_LABELS[current.provider]} · {current.username}
            {count > 1 ? ` · ${at + 1} of ${count}` : ""}
          </span>
          {current.note ? <em>{current.note}</em> : null}
        </div>
        <button
          type="button"
          className="cflow-arrow"
          onClick={() => go(at + 1)}
          disabled={at === count - 1}
          aria-label="Next playlist"
        >
          ›
        </button>
      </div>

      <div className="cflow-actions">
        <button type="button" className="cflow-play" onClick={() => setPlaying((p) => !p)}>
          {playing ? "Close the player" : "Play it"}
        </button>
        <a href={openUrl(current)} target="_blank" rel="noreferrer" className="cflow-open">
          Open in {PROVIDER_LABELS[current.provider]}
        </a>
      </div>

      {/* One player, for the one in front, once somebody asks. Keyed on
          the playlist so moving along the deck tears the old embed down
          rather than reusing the frame and leaving the last one playing. */}
      {playing && (
        <div className="cflow-player">
          <iframe
            key={current.id}
            src={embedUrl(current)}
            title={current.title}
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}
