"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { AddToQueueButton } from "@/components/AddToQueueButton";
import type { Find } from "@/lib/musicDiscovery";

// A rack of records, filed on their spines.
//
// In a shop nothing is face on. Records stand on their edges, packed
// tight, and you walk along pushing them over with two fingers until one
// stops you. A row of cover art is a shop where somebody has taken four
// hundred records out of the rack and laid them on the floor, which is
// not a nicer version of digging: it is the thing digging exists instead
// of. You cannot flick past ninety records laid face up, and flicking
// past ninety is the whole pleasure.
//
// So the spines scroll, and the one you press comes out and turns over.

// One shared player for the page. Every card owning an <audio> means two
// can play at once, which on a page whose entire purpose is "listen to
// this" is the thing that must not happen.
let audio: HTMLAudioElement | null = null;
let playingKey: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function stop() {
  playingKey = null;
  emit();
}
function togglePreview(key: string, url: string) {
  if (!audio) {
    audio = new Audio();
    // A clip that ends, fails or is stopped leaves the button reading
    // "playing" unless the state is put back, which looks like a dead
    // player rather than a finished one.
    audio.addEventListener("ended", stop);
    audio.addEventListener("error", stop);
  }
  if (playingKey === key) {
    audio.pause();
    stop();
    return;
  }
  audio.src = url;
  playingKey = key;
  emit();
  void audio.play().catch(stop);
}
function usePlayingKey(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => playingKey,
    () => null
  );
}

/**
 * A rack, with its divider card.
 *
 * Nothing is pulled out to begin with. A rack that opens with a record
 * already in your hand has picked for you, and picking is the point.
 */
export function RecordRack({
  title,
  subtitle,
  finds,
  empty,
}: {
  title: string;
  subtitle?: string;
  finds: Find[];
  /** Said out loud when the rack is empty, rather than showing a gap. */
  empty: string;
}) {
  const [heldKey, setHeldKey] = useState<string | null>(null);
  const held = finds.find((f) => f.key === heldKey) ?? null;
  const playing = usePlayingKey();

  return (
    <section className="rack-section">
      {/* The card a shop slips into the rack to name a section. */}
      <div className="rack-card">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>

      <div className="rack">
        {finds.length === 0 ? (
          <div className="rack-empty">{empty}</div>
        ) : (
          <>
            <div className="rack-row">
              {finds.map((find) => (
                <button
                  key={find.key}
                  type="button"
                  className={`rack-spine${find.key === heldKey ? " pulled" : ""}`}
                  aria-pressed={find.key === heldKey}
                  // The sleeve's own art, seen edge on. The art wraps
                  // round most sleeves, so the edge really is the colour
                  // of the record rather than a neutral grey - which is
                  // also why a rack of these reads as a rack rather than
                  // as a row of tabs.
                  style={
                    find.imageUrl
                      ? { backgroundImage: `url(${find.imageUrl})` }
                      : { backgroundColor: "#3a3a40" }
                  }
                  onClick={() => setHeldKey(find.key === heldKey ? null : find.key)}
                >
                  <span className="rack-spine-text">
                    {find.artist} {find.name}
                  </span>
                </button>
              ))}
            </div>
            <div className="rack-base" aria-hidden="true" />
          </>
        )}

        {held && (
          <div className="rack-held">
            <div className="rack-held-art">
              {held.imageUrl ? (
                // Cover art comes from Apple's and Last.fm's CDNs, which
                // are not in next.config's image allowlist. A plain img
                // avoids adding every music CDN on earth to it.
                <img src={held.imageUrl} alt="" />
              ) : null}
            </div>
            <div className="rack-held-body">
              <b>{held.name}</b>
              <span className="by">{held.artist}</span>
              {held.becauseOf ? (
                <span className="why">Because you liked {held.becauseOf}</span>
              ) : null}
              <div className="rack-held-actions">
                {held.previewUrl ? (
                  <button
                    type="button"
                    className="rack-link"
                    onClick={() => togglePreview(held.key, held.previewUrl!)}
                  >
                    {playing === held.key ? "Stop" : "Hear it"}
                  </button>
                ) : null}
                <Link
                  href={`/post/new?type=music&title=${encodeURIComponent(
                    held.name
                  )}&artist=${encodeURIComponent(held.artist)}`}
                  className="rack-link"
                >
                  Review
                </Link>
                <AddToQueueButton
                  mediaType="music"
                  title={held.name}
                  artist={held.artist}
                  coverUrl={held.imageUrl}
                />
                <button type="button" className="rack-link" onClick={() => setHeldKey(null)}>
                  Put it back
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
