"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AddToQueueButton } from "@/components/AddToQueueButton";
import type { Find } from "@/lib/musicDiscovery";
import { formatFor } from "@/lib/physicalMedia";
import { useOnScreen, useSleeves } from "@/lib/useSleeves";

// A rack of records you flick through.
//
// This filed them on their spines twice, and got called a bookshelf
// twice, which was fair. The error was reasoning from how a record is
// stored rather than from how one is looked through. Spines are for the
// wall at home, where you already own everything and are looking for a
// title you can name. Nobody reads spines in a shop. You push the front
// record over with two fingers and look at the next cover, and the next,
// and what is in front of you the whole time is artwork on a lean with
// the edges of forty more stacked up behind it.
//
// So: covers, face out, tipped back, each one overlapping the one before
// it so about a third shows. Flicking past ninety is still the pleasure,
// and now the thing you flick past is the thing worth looking at.

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

  // The clip for whatever is in your hand, looked up when you pull it.
  //
  // The rail enriches what it can up front, but a lookup that came back
  // empty - and most of them do when Apple is throttling - left the
  // record with no Hear it at all, so pulling one out of the rack and
  // finding nothing to press is the commonest thing that happens. Asking
  // again for the ONE record somebody has actually chosen is a single
  // request at the moment it is wanted, which is both cheap and the only
  // time it is certainly worth making.
  const [pulledClip, setPulledClip] = useState<Record<string, string | null>>({});
  useEffect(() => {
    if (!held || held.previewUrl || pulledClip[held.key] !== undefined) return;
    let cancelled = false;
    const params = new URLSearchParams({ title: held.name, artist: held.artist });
    fetch(`/api/crate/sleeve?${params.toString()}`)
      .then((res) => res.json())
      .then((data: { previewUrl: string | null }) => {
        if (!cancelled) setPulledClip((prev) => ({ ...prev, [held.key]: data.previewUrl ?? null }));
      })
      // Marked as looked-up either way, so a failing record does not
      // re-request every time the component renders.
      .catch(() => {
        if (!cancelled) setPulledClip((prev) => ({ ...prev, [held.key]: null }));
      });
    return () => {
      cancelled = true;
    };
  }, [held, pulledClip]);
  const heldClip = held ? held.previewUrl ?? pulledClip[held.key] ?? null : null;

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
                <Spine
                  key={find.key}
                  find={find}
                  held={find.key === heldKey}
                  onPick={() => setHeldKey(find.key === heldKey ? null : find.key)}
                />
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
                {heldClip ? (
                  <button
                    type="button"
                    className="rack-link"
                    onClick={() => togglePreview(held.key, heldClip)}
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

/**
 * One record in the rack.
 *
 * Its own component so it can watch its own element. The rail arrives
 * with artwork on the handful the server managed to enrich and nothing
 * on the rest, and a record with no artwork used to render as its own
 * background colour - a dark square, which on a twelve inch sleeve with
 * the disc drawn behind it came out as a black slab in the middle of a
 * row of covers. That is what "the vinyls show up black" was.
 *
 * Two fixes, and the first one is the real one: ask for the cover. The
 * shelves already look up what scrolls into view and batch it into one
 * request, and there was no reason the rack should not do the same. The
 * second is that a record the catalogue genuinely does not have now
 * draws as a plain sleeve with its name printed on it, the way a white
 * label actually looks, instead of as a hole in the rack.
 */
function Spine({ find, held, onPick }: { find: Find; held: boolean; onPick: () => void }) {
  const { want, get } = useSleeves();
  const info = get(find.key);
  const art = find.imageUrl ?? info?.artworkUrl ?? null;
  const ref = useOnScreen(
    () => want({ key: find.key, title: find.name, artist: find.artist }),
    !find.imageUrl
  );

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
      className={`rack-spine fmt-${formatFor(find.key, find.year ?? info?.year)}${
        held ? " pulled" : ""
      }${art ? "" : " blank"}`}
      aria-pressed={held}
      onClick={onPick}
    >
      {/* The cover, face on and unblurred. It is the whole reason to
          look, and the reason nothing is printed over it: on a record
          the artwork IS the label, and a caption laid on top of one only
          says you did not trust it. A sleeve with no artwork is the one
          case that does want its name on it, because otherwise there is
          nothing there at all. */}
      {art ? (
        <span
          className="rack-spine-ink"
          style={{ backgroundImage: `url(${art})` }}
          aria-hidden="true"
        />
      ) : (
        <span className="rack-spine-ink blank" aria-hidden="true" />
      )}
      <span className="rack-spine-text">
        <b>{find.artist}</b> {find.name}
      </span>
    </button>
  );
}
