"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AddToQueueButton } from "@/components/AddToQueueButton";
import type { Sleeve } from "@/lib/crate";

// The records on a shelf.
//
// A grid rather than a rail, because a shelf is a thing you scan across
// and down - and unlike the Discover rails, none of these is here for a
// reason worth printing on it. The order is the tag chart's, trimmed.

type SleeveInfo = { artworkUrl: string | null; previewUrl: string | null; trackUrl: string | null };

// One player for the page, same as everywhere else that plays a clip.
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
function toggle(key: string, url: string) {
  if (!audio) {
    audio = new Audio();
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

export function ShelfRecords({ records, emptyNote }: { records: Sleeve[]; emptyNote: string }) {
  const [info, setInfo] = useState<Record<string, SleeveInfo>>({});
  const playing = useSyncExternalStore(
    subscribe,
    () => playingKey,
    () => null
  );

  // Art and clips are fetched for the whole shelf, but a few at a time.
  // Twenty-four parallel lookups from one address is the shape Apple
  // rate-limits; four at a time fills the grid in a couple of seconds
  // and never trips it.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let cancelled = false;
    let cursor = 0;

    async function worker() {
      while (cursor < records.length && !cancelled) {
        const record = records[cursor++];
        const params = new URLSearchParams({ title: record.name, artist: record.artist });
        const data: SleeveInfo = await fetch(`/api/crate/sleeve?${params.toString()}`)
          .then((res) => res.json())
          // A record with no cover still belongs on the shelf.
          .catch(() => ({ artworkUrl: null, previewUrl: null, trackUrl: null }));
        if (!cancelled) setInfo((prev) => ({ ...prev, [record.key]: data }));
      }
    }

    void Promise.all(Array.from({ length: Math.min(4, records.length) }, worker));
    return () => {
      cancelled = true;
    };
  }, [records]);

  if (records.length === 0) {
    return <p className="shelf-empty">{emptyNote}</p>;
  }

  return (
    <div className="shelf-grid">
      {records.map((record) => {
        const art = info[record.key]?.artworkUrl ?? record.imageUrl;
        const clip = info[record.key]?.previewUrl ?? null;
        const isPlaying = playing === record.key;
        const reviewHref = `/post/new?type=music&title=${encodeURIComponent(
          record.name
        )}&artist=${encodeURIComponent(record.artist)}`;

        return (
          <article className="shelf-record" key={record.key}>
            <div className="shelf-art">
              {art ? (
                <img src={art} alt="" loading="lazy" />
              ) : (
                <div className="shelf-art-blank" aria-hidden="true">
                  <span />
                </div>
              )}
              {clip && (
                <button
                  type="button"
                  className={`shelf-play${isPlaying ? " playing" : ""}`}
                  aria-label={isPlaying ? `Stop ${record.name}` : `Hear ${record.name}`}
                  onClick={() => toggle(record.key, clip)}
                >
                  <span aria-hidden="true">{isPlaying ? "■" : "▶"}</span>
                </button>
              )}
            </div>
            <div className="shelf-name" title={record.name}>
              {record.name}
            </div>
            <div className="shelf-artist" title={record.artist}>
              {record.artist}
            </div>
            <div className="shelf-actions">
              <Link href={reviewHref} className="shelf-review">
                Review
              </Link>
              <AddToQueueButton
                mediaType="music"
                title={record.name}
                artist={record.artist}
                coverUrl={art}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}
