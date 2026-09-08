"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { AddToQueueButton } from "@/components/AddToQueueButton";
import type { Sleeve } from "@/lib/crate";
import { formatFor, formatForDecadeTag, type MediaFormat } from "@/lib/physicalMedia";
import { belongsOnShelf, type ShelfSpan } from "@/lib/shelfSpan";
import { knownTrackVideo, resolveTrackVideoId } from "@/lib/trackVideo";
import { useOnScreen, useSleeves } from "@/lib/useSleeves";

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

/**
 * How many records stand on the boards.
 *
 * The server sends ninety and this shows fifty; the other forty are
 * replacements for whatever turns out to be unplayable.
 */
const SHOW = 50;

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

// One video at a time, for the same reason there is one <audio>: a wall
// of covers where two of them are playing is the thing that must not
// happen on a page about listening.
let videoKey: string | null = null;
const videoListeners = new Set<() => void>();
function emitVideo() {
  for (const listener of videoListeners) listener();
}
function subscribeVideo(listener: () => void) {
  videoListeners.add(listener);
  return () => {
    videoListeners.delete(listener);
  };
}
function showVideo(key: string | null) {
  // Starting a video stops the clip, and vice versa. Two players is two
  // songs.
  if (key) {
    audio?.pause();
    stop();
  }
  videoKey = key;
  emitVideo();
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
   * Every axis here is a Last.fm user tag, and a tag is a folksonomy.
   * Without this a shelf headed 1994 shows whatever people happened to
   * tag "1994", which is how a 2013 record ends up on it.
   */
  span?: ShelfSpan | null;
}) {
  // One format for a decade shelf, so the era reads at a glance. On any
  // other shelf the record's own year decides, and only a record with no
  // known year falls back to a hash of its key - which is stable, so a
  // record is not a cassette on one render and a CD on the next.
  const shelfFormat: MediaFormat | null = decade ? formatForDecadeTag(decade) : null;
  // A shelf that claims a span is a shelf that will throw a record off
  // for being from the wrong time, so those - and only those - are worth
  // paying an extra lookup to date properly. Scene and Place claim no
  // years and check none.
  const { want, get, pending } = useSleeves({ needYear: !!span });
  const playing = useSyncExternalStore(
    subscribe,
    () => playingKey,
    () => null
  );
  const showing = useSyncExternalStore(
    subscribeVideo,
    () => videoKey,
    () => null
  );

  if (records.length === 0) {
    return <p className="shelf-empty">{emptyNote}</p>;
  }

  // What actually goes on the boards.
  //
  // The server sends more records than the shelf shows. A record the
  // catalogue has no cover and no clip for is a blank sleeve with
  // nothing to press, so as soon as a lookup says that, it is dropped
  // and the next record down takes its place - which is why the extra
  // ones are fetched at all.
  //
  // Only records we have actually heard back about are dropped. One
  // still in flight keeps its place and shows that it is working,
  // because moving a record out from under somebody while they are
  // looking at it is worse than a moment of not knowing.
  const shown: Sleeve[] = [];
  const passedOver: Sleeve[] = [];
  for (const record of records) {
    if (shown.length >= SHOW) break;
    const info = get(record.key);
    const dead =
      info !== undefined &&
      !info.artworkUrl &&
      !info.previewUrl &&
      !record.imageUrl &&
      !record.previewUrl &&
      !record.videoId;
    if (dead) {
      passedOver.push(record);
      continue;
    }
    shown.push(record);
  }
  // Nothing is dropped unless something takes its place.
  //
  // This is the bug behind "the shelves don't load at all". The swap-out
  // above is right when there is a replacement to swap in - but when
  // Apple is throttling, EVERY record on the shelf comes back with no
  // cover and no clip, so every one of them was judged dead and the
  // shelf rendered as nothing whatsoever. Not blank sleeves: no shelf.
  // A page that was working an hour ago showing an empty wooden board.
  //
  // A record nobody can find a cover for is still a record. It has a
  // name, it has an artist, and the thing this site is actually for -
  // writing about it - needs neither a picture nor a clip. So the
  // passed-over ones come back rather than the shelf emptying, and they
  // draw as what they are: a white label with the name printed on it.
  if (shown.length < SHOW) {
    for (const record of passedOver) {
      shown.push(record);
      if (shown.length >= SHOW) break;
    }
  }

  return (
    <div className="woodwall">
      <div className="woodgrid">
        {shown.map((record) => (
          <ShelfRecord
            key={record.key}
            record={record}
            shelfFormat={shelfFormat}
            span={span ?? null}
            info={get(record.key)}
            waiting={pending(record.key)}
            want={want}
            playing={playing === record.key}
            showingVideo={showing === record.key}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * One record on the board.
 *
 * Its own component so it can have its own element to watch: the lookup
 * happens when this record scrolls near the screen rather than when the
 * shelf mounts. A fifty record shelf costs a screenful of lookups, not
 * fifty, and the ones somebody is actually looking at are no longer
 * queued behind forty they are not.
 */
function ShelfRecord({
  record,
  shelfFormat,
  span,
  info,
  waiting,
  want,
  playing,
  showingVideo,
}: {
  record: Sleeve;
  shelfFormat: MediaFormat | null;
  span: ShelfSpan | null;
  info: ReturnType<ReturnType<typeof useSleeves>["get"]>;
  /** Asked for, not answered yet. Drawn as working rather than as blank. */
  waiting: boolean;
  want: ReturnType<typeof useSleeves>["want"];
  playing: boolean;
  /** This is the one tile playing a video, if any tile is. */
  showingVideo: boolean;
}) {
  // Rows that arrived from the server with their cover and clip already
  // on them are asked for nothing: that request could only return what
  // we have.
  const settled = !!record.previewUrl && !!record.imageUrl;
  const ref = useOnScreen(
    () => want({ key: record.key, title: record.name, artist: record.artist }),
    !settled
  );

  const art = info?.artworkUrl ?? record.imageUrl;
  const clip = info?.previewUrl ?? record.previewUrl;
  const year = info?.year ?? record.year;

  // The other way to play a record. Only reached when the catalogue has
  // no clip for it, only when somebody presses the button, and only once
  // per record for the whole site - see lib/trackVideo. A shelf must
  // never spend a YouTube search on its own.
  //
  // A record that arrived FROM YouTube already knows its video and skips
  // all of that: the scene shelves hand the id over with the row, so
  // every sleeve on them plays on the first press with nothing looked up
  // at all.
  const [video, setVideo] = useState<{ id: string | null; error: string | null } | null>(
    () => {
      if (record.videoId) return { id: record.videoId, error: null };
      const already = knownTrackVideo(record.key);
      return already ? { id: already.videoId, error: already.error } : null;
    }
  );
  const [finding, setFinding] = useState(false);

  // A record that turned out not to be from this shelf's years comes off
  // it. Only one we have actually looked up and actually disagree with:
  // an unknown year keeps its place, because a shelf that hid everything
  // it could not verify would empty itself the moment Apple started
  // throttling and call that "nothing was made that year".
  if (!belongsOnShelf(year, span)) return null;

  const format = shelfFormat ?? formatFor(record.key, year);
  const reviewHref = `/post/new?type=music&title=${encodeURIComponent(
    record.name
  )}&artist=${encodeURIComponent(record.artist)}`;

  return (
    <article className="woodslot" ref={ref as React.Ref<HTMLElement>}>
      <div className={`wooditem fmt-${format}`}>
        {showingVideo && video?.id ? (
          // In the sleeve, where the record is. Same as the crate and
          // same as a film's trailer: the thing you are looking at is
          // the thing making the noise.
          <iframe
            src={`https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0`}
            title={`${record.name} by ${record.artist}`}
            allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : art ? (
          <img src={art} alt="" loading="lazy" decoding="async" />
        ) : (
          // Three states, not two. A cover on its way and a record the
          // catalogue does not have looked identical, so a shelf that
          // had finished looked exactly like one still working and the
          // only way to tell was to keep staring at it.
          <div
            className={`wood-blank${waiting ? " waiting" : ""}`}
            aria-label={waiting ? `Finding the cover for ${record.name}` : undefined}
            aria-busy={waiting || undefined}
          >
            {/* A white label, which is what a record with no artwork
                actually looks like - the name stamped on plain paper.
                An empty square is not a state anybody can read: it says
                nothing about whether the record exists, whether it is
                still loading, or what it even is. Hidden while the
                lookup is still out, because a name appearing and then
                being replaced by a cover reads as a glitch. */}
            {!waiting && (
              <span className="wood-label-print">
                <b>{record.artist}</b>
                <i>{record.name}</i>
              </span>
            )}
          </div>
        )}
        {clip ? (
          <button
            type="button"
            className={`wood-play${playing ? " playing" : ""}`}
            aria-label={playing ? `Stop ${record.name}` : `Hear ${record.name}`}
            onClick={() => toggle(record.key, clip)}
          >
            <span aria-hidden="true">{playing ? "■" : "▶"}</span>
          </button>
        ) : info ? (
          // No clip in the catalogue, which on a shelf of genuinely
          // obscure records is most of them - and a record you cannot
          // play is the complaint this whole area keeps generating. So
          // the button is here anyway and finds the record on YouTube
          // the first time anybody presses it.
          <button
            type="button"
            className={`wood-play${showingVideo ? " playing" : ""}${
              video?.error ? " dead" : ""
            }`}
            aria-label={
              video?.error
                ? `No way to play ${record.name}`
                : showingVideo
                ? `Stop ${record.name}`
                : `Play ${record.name}`
            }
            aria-busy={finding || undefined}
            disabled={finding || !!video?.error}
            onClick={async () => {
              if (showingVideo) {
                showVideo(null);
                return;
              }
              if (video?.id) {
                showVideo(record.key);
                return;
              }
              setFinding(true);
              const found = await resolveTrackVideoId(record.key, record.name, record.artist);
              setFinding(false);
              setVideo({ id: found.videoId, error: found.error });
              if (found.videoId) showVideo(record.key);
            }}
          >
            <span aria-hidden="true">
              {finding ? "…" : video?.error ? "×" : showingVideo ? "■" : "▶"}
            </span>
          </button>
        ) : null}
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
}
