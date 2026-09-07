"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AddToQueueButton } from "@/components/AddToQueueButton";
import type { Sleeve } from "@/lib/crate";
import { formatFor, formatForDecadeTag, type MediaFormat } from "@/lib/physicalMedia";
import { belongsOnShelf, type ShelfSpan } from "@/lib/shelfSpan";

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

type SleeveInfo = {
  artworkUrl: string | null;
  previewUrl: string | null;
  trackUrl: string | null;
  /** What the catalogue says the record came out. Null when it does not
   *  know, which is not the same as the record being from another year. */
  year?: number | null;
};

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
  span,
}: {
  records: Sleeve[];
  emptyNote: string;
  /** The decade this shelf is about, when it is about one. */
  decade?: string | null;
  /**
   * The years this shelf claims, on the two axes that claim any.
   *
   * The shelf checks the rows it looked up on the server; these are the
   * rest, checked here as their own lookups land. Without it a shelf
   * headed 1994 shows whatever people happened to tag "1994", which is
   * how a 2013 record ends up on it.
   */
  span?: ShelfSpan | null;
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
  // This said four at a time "never trips it", and that was simply
  // wrong: a shelf of twenty four came back with artwork on two. Apple
  // allows roughly twenty calls a minute and answers 403 above that, and
  // a 403 was being read as "no such track", so twenty two records
  // reported confidently and permanently that they were not in the
  // catalogue. Two at a time with a gap between them stays under the
  // limit, and lib/itunes retries the throttle now rather than believing
  // it.
  // Keyed on the shelf itself, not on "has this ever run".
  //
  // This used to be a plain `started` ref, which is right for a component
  // that mounts once and wrong for this one: switching from Scene to
  // Decade is a client navigation, React keeps the same instance because
  // it is in the same place in the tree, and the ref was still true. So
  // the new shelf never looked anything up and arrived with no covers and
  // no previews, while the first tab somebody opened worked perfectly.
  // Comparing the records instead means a new shelf is a new fetch and
  // the same shelf re-rendering is not.
  const shelfId = records.map((r) => r.key).join("|");
  const fetchedFor = useRef<string | null>(null);
  useEffect(() => {
    if (fetchedFor.current === shelfId) return;
    fetchedFor.current = shelfId;
    let cancelled = false;
    let cursor = 0;

    async function worker() {
      while (cursor < records.length && !cancelled) {
        const record = records[cursor++];
        // The first rows arrive from the server with their cover and clip
        // already on them, so asking again for those is a request that
        // can only return what we have.
        if (record.previewUrl || record.imageUrl) {
          setInfo((prev) => ({
            ...prev,
            [record.key]: {
              artworkUrl: record.imageUrl,
              previewUrl: record.previewUrl,
              trackUrl: record.storeUrl,
            },
          }));
          if (record.previewUrl) continue;
        }
        const params = new URLSearchParams({ title: record.name, artist: record.artist });
        const data: SleeveInfo = await fetch(`/api/crate/sleeve?${params.toString()}`)
          .then((res) => res.json())
          // A record with no cover still belongs on the shelf.
          .catch(() => ({ artworkUrl: null, previewUrl: null, trackUrl: null }));
        if (!cancelled) setInfo((prev) => ({ ...prev, [record.key]: data }));
        // A gap, so a long shelf arrives as a queue rather than a burst.
        await new Promise((r) => setTimeout(r, 160));
      }
    }

    void Promise.all(Array.from({ length: Math.min(2, records.length) }, worker));
    return () => {
      cancelled = true;
    };
  }, [records, shelfId]);

  // Records that turned out not to be from this shelf's years come off
  // it. Only ones we have actually looked up and actually disagree
  // with: an unknown year keeps its place, because a shelf that hid
  // everything it could not verify would empty itself the moment Apple
  // started throttling and call that "nothing was made that year".
  const shown = span
    ? records.filter((record) => belongsOnShelf(info[record.key]?.year ?? record.year, span))
    : records;

  if (records.length === 0) {
    return <p className="shelf-empty">{emptyNote}</p>;
  }

  return (
    <div className="woodwall">
      <div className="woodgrid">
      {shown.map((record) => {
        const art = info[record.key]?.artworkUrl ?? record.imageUrl;
        const clip = info[record.key]?.previewUrl ?? null;
        const isPlaying = playing === record.key;
        const reviewHref = `/post/new?type=music&title=${encodeURIComponent(
          record.name
        )}&artist=${encodeURIComponent(record.artist)}`;

        // A decade shelf answers for the whole shelf; otherwise the
        // record's own year answers, and only a record with no known
        // year falls back to the hash.
        const format = shelfFormat ?? formatFor(record.key, info[record.key]?.year ?? record.year);

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
