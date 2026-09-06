"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { AddToQueueButton } from "@/components/AddToQueueButton";
import type { Find } from "@/lib/musicDiscovery";

// One shared player for the whole page.
//
// Every card having its own <audio> means two of them can play at once,
// which on a page whose entire purpose is "listen to this" is the one
// thing that must not happen. So there is a single element, and the key
// of whatever is coming out of it is the state the buttons read.
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
    // A clip that ends, fails to load, or is stopped all leave the button
    // showing "playing" unless the state is put back - which looks like a
    // dead player rather than a finished one.
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

function FindCard({ find }: { find: Find }) {
  const playing = usePlayingKey() === find.key;
  const reviewHref = `/post/new?type=music&title=${encodeURIComponent(
    find.name
  )}&artist=${encodeURIComponent(find.artist)}`;

  return (
    <article className="find-card">
      <div className="find-art">
        {find.imageUrl ? (
          // Cover art comes from Apple's and Last.fm's CDNs, which aren't
          // in next.config's image allowlist - a plain img avoids adding
          // every music CDN on earth to it.
          <img src={find.imageUrl} alt="" loading="lazy" />
        ) : (
          <div className="find-art-blank" aria-hidden="true" />
        )}

        {find.previewUrl ? (
          <button
            type="button"
            className={`find-play${playing ? " playing" : ""}`}
            aria-label={playing ? `Stop ${find.name}` : `Play a preview of ${find.name}`}
            onClick={() => togglePreview(find.key, find.previewUrl!)}
          >
            <span aria-hidden="true">{playing ? "■" : "▶"}</span>
          </button>
        ) : null}
      </div>

      <div className="find-name" title={find.name}>
        {find.name}
      </div>
      <div className="find-artist" title={find.artist}>
        {find.artist}
      </div>
      {find.becauseOf ? (
        <div className="find-why">Because you liked {find.becauseOf}</div>
      ) : null}

      <div className="find-actions">
        <Link href={reviewHref} className="find-review">
          Review
        </Link>
        <AddToQueueButton mediaType="music" title={find.name} artist={find.artist} coverUrl={find.imageUrl} />
      </div>
    </article>
  );
}

/**
 * A row of things to listen to.
 *
 * Scrolls sideways rather than wrapping, so a rail is one glance and the
 * rails below it stay on screen - the point of the page is that there are
 * several directions to go in, not one long list.
 */
export function FindRail({
  title,
  subtitle,
  finds,
  empty,
}: {
  title: string;
  subtitle?: string;
  finds: Find[];
  /** Said out loud when there is nothing, instead of an empty rail. */
  empty: string;
}) {
  return (
    <section className="find-rail">
      <div className="find-rail-head">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {finds.length === 0 ? (
        <div className="find-rail-empty">{empty}</div>
      ) : (
        <div className="find-row">
          {finds.map((find) => (
            <FindCard key={find.key} find={find} />
          ))}
        </div>
      )}
    </section>
  );
}
