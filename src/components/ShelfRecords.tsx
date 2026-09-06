"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AddToQueueButton } from "@/components/AddToQueueButton";
import type { Sleeve } from "@/lib/crate";
import { formatForDecadeTag, formatForKey, type MediaFormat } from "@/lib/physicalMedia";

// The records on a shelf, which is a wooden shelf.
//
// Newsstand, essentially: the covers stand on a board with a contact
// shadow at the foot, and the card telling you what each one is sits in
// the shade under the board, which is where a shop puts it.
//
// Each record is drawn as the object it would actually have been. A
// shelf of 1974 albums is sleeves with the vinyl showing past the open
// edge; a shelf of 1996 is jewel cases. When the shelf IS a decade the
// decade decides, since that is a better answer than any single track's
// own year - the shelf is about the era, so the objects should be too.

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

export function ShelfRecords({
  records,
  emptyNote,
  decade,
}: {
  records: Sleeve[];
  emptyNote: string;
  /** The decade this shelf is about, when it is about one. */
  decade?: string | null;
}) {
  // One format for a decade shelf, so the era reads at a glance. On any
  // other shelf each record gets its own, hashed off its key rather than
  // rolled, because a record that is a cassette on one render and a CD
  // on the next is a shelf that flickers.
  const shelfFormat: MediaFormat | null = decade ? formatForDecadeTag(decade) : null;
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
    <div className="woodwall">
      <div className="woodgrid">
      {records.map((record) => {
        const art = info[record.key]?.artworkUrl ?? record.imageUrl;
        const clip = info[record.key]?.previewUrl ?? null;
        const isPlaying = playing === record.key;
        const reviewHref = `/post/new?type=music&title=${encodeURIComponent(
          record.name
        )}&artist=${encodeURIComponent(record.artist)}`;

        const format = shelfFormat ?? formatForKey(record.key);

        return (
          <article className="woodslot" key={record.key}>
            <div className={`wooditem fmt-${format}`}>
              {art ? (
                <img src={art} alt="" loading="lazy" />
              ) : (
                <div className="wood-blank" aria-hidden="true" />
              )}
              {clip && (
                <button
                  type="button"
                  className={`wood-play${isPlaying ? " playing" : ""}`}
                  aria-label={isPlaying ? `Stop ${record.name}` : `Hear ${record.name}`}
                  onClick={() => toggle(record.key, clip)}
                >
                  <span aria-hidden="true">{isPlaying ? "\u25A0" : "\u25B6"}</span>
                </button>
              )}
            </div>
            <div className="woodlabel">
              <b title={record.name}>{record.name}</b>
              <span title={record.artist}>{record.artist}</span>
            </div>
            <div className="woodactions">
              <Link href={reviewHref} className="wood-link">
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
    </div>
  );
}
