"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { markQueueDone, markQueueUndone, removeFromQueue } from "@/app/actions/queue";
import { formatForKey, type MediaFormat } from "@/lib/physicalMedia";
import { QUEUE_DONE_LABEL, reviewHref, type QueueItem } from "@/lib/queue";

// Your shelf, with the records playable.
//
// A shelf of things you mean to listen to that you cannot listen to is a
// list of homework. The clip is thirty seconds and it is the difference
// between "I should get to that" and getting to it, so the same lookup
// the Crate and the Shelves use runs here too.
//
// Only music. A film case and a photograph have nothing to play, and a
// dead play button on them would be worse than none.

type Info = { previewUrl: string | null };

// One player for the page, same as everywhere else that plays a clip.
let audio: HTMLAudioElement | null = null;
let playingId: string | null = null;
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
  playingId = null;
  emit();
}
function toggle(id: string, url: string) {
  if (!audio) {
    audio = new Audio();
    audio.addEventListener("ended", stop);
    audio.addEventListener("error", stop);
  }
  if (playingId === id) {
    audio.pause();
    stop();
    return;
  }
  audio.src = url;
  playingId = id;
  emit();
  void audio.play().catch(stop);
}

/** What a queued thing would sit on a shelf as. */
function shelfFormat(item: QueueItem): MediaFormat | "case" {
  // A film is a tall case with a spine whatever year it is from, and a
  // photograph has no object either, so it gets the glass a download
  // gets. Music is the only one with a real answer, and with no year on a
  // queue row that answer comes from the title.
  if (item.mediaType === "movie_tv") return "case";
  if (item.mediaType === "photography") return "download";
  return formatForKey(`${item.title} ${item.subtitle ?? ""}`);
}

export function YourShelf({
  items,
  done,
  owner = true,
}: {
  items: QueueItem[];
  done: boolean;
  /**
   * Whether this is the viewer's own shelf.
   *
   * The same shelf appears on a profile, where a visitor is looking at
   * somebody else's. Everything that CHANGES it comes off then - taking
   * a record down, marking it played, putting it back - because those
   * are the owner's gestures and the server would refuse them anyway.
   * What is left is the shelf as an object: covers, names, and the clip,
   * which is the part worth showing a stranger.
   */
  owner?: boolean;
}) {
  const [info, setInfo] = useState<Record<string, Info>>({});
  const playing = useSyncExternalStore(
    subscribe,
    () => playingId,
    () => null
  );

  // Two at a time, with a gap. Apple allows about twenty calls a minute
  // and answers 403 above that, which lib/itunes used to read as "no such
  // track" - so a long shelf came back almost entirely blank and looked
  // like a catalogue full of holes rather than a queue going too fast.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const music = items.filter((i) => i.mediaType === "music");
    let cancelled = false;
    let cursor = 0;

    async function worker() {
      while (cursor < music.length && !cancelled) {
        const item = music[cursor++];
        const params = new URLSearchParams({
          title: item.title,
          artist: item.subtitle ?? "",
        });
        // 503 is Apple saying "not now", not "this record has no clip".
        // Recorded as an answer it takes the play button off a record
        // that has a perfectly good preview, for as long as the page is
        // open - which is what "the previews are missing on my own
        // shelf" was. So a refusal is waited out and asked again, and
        // only a real answer is written down.
        async function ask(): Promise<Info | null> {
          const res = await fetch(`/api/crate/sleeve?${params.toString()}`);
          if (!res.ok) return null;
          return (await res.json()) as Info;
        }
        let data = await ask().catch(() => null);
        if (data === null) {
          await new Promise((r) => setTimeout(r, 1400));
          data = await ask().catch(() => null);
        }
        // A record with no clip is still on the shelf.
        if (!cancelled) setInfo((prev) => ({ ...prev, [item.id]: data ?? { previewUrl: null } }));
        await new Promise((r) => setTimeout(r, 160));
      }
    }

    void Promise.all(Array.from({ length: Math.min(2, music.length) }, worker));
    return () => {
      cancelled = true;
    };
  }, [items]);

  return (
    <div className={done ? "woodwall played-wall" : "woodwall"}>
      <div className="woodgrid">
        {items.map((item) => {
          const clip = info[item.id]?.previewUrl ?? null;
          const isPlaying = playing === item.id;
          return (
            <article className={done ? "woodslot played" : "woodslot"} key={item.id}>
              <div className={`wooditem fmt-${shelfFormat(item)}`}>
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" loading="lazy" />
                ) : (
                  <div className="wood-blank" aria-hidden="true" />
                )}
                {clip && (
                  <button
                    type="button"
                    className={`wood-play${isPlaying ? " playing" : ""}`}
                    aria-label={isPlaying ? `Stop ${item.title}` : `Hear ${item.title}`}
                    onClick={() => toggle(item.id, clip)}
                  >
                    <span aria-hidden="true">{isPlaying ? "■" : "▶"}</span>
                  </button>
                )}
                {/* Taking it off the shelf lives on the record itself.
                    Under it, beside the other two, it was a third link in
                    a column with room for two. */}
                {owner && (
                  <form action={removeFromQueue} className="inline-form">
                    <input type="hidden" name="id" value={item.id} />
                    <button
                      type="submit"
                      className="wood-remove"
                      aria-label={`Take ${item.title} off the shelf`}
                    >
                      <span aria-hidden="true">&times;</span>
                    </button>
                  </form>
                )}
              </div>
              <div className="woodlabel">
                <b title={item.title}>{item.title}</b>
                <span title={item.subtitle ?? ""}>
                  {item.subtitle || (item.fromPostId ? "someone talked you into it" : " ")}
                </span>
              </div>
              <div className="woodactions">
                {!owner ? (
                  // A visitor gets the one action that is theirs to
                  // take: write their own review of it. Not "mark it
                  // played" on somebody else's shelf.
                  <Link href={reviewHref(item)} className="wood-link">
                    Review
                  </Link>
                ) : done ? (
                  <form action={markQueueUndone} className="inline-form">
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit">Put it back</button>
                  </form>
                ) : (
                  <>
                    {/* Still the point of the page: the shelf is a stack
                        of reviews waiting to be written, and starting one
                        is a press with the fields already filled in. */}
                    <Link href={reviewHref(item)} className="wood-link">
                      Review
                    </Link>
                    <form action={markQueueDone} className="inline-form">
                      <input type="hidden" name="id" value={item.id} />
                      <button type="submit">{QUEUE_DONE_LABEL[item.mediaType]}</button>
                    </form>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
