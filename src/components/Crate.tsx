"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { addToQueue, type QueueState } from "@/app/actions/queue";
import type { Sleeve } from "@/lib/crate";
import { FORMAT_LABELS, formatFor, formatForKey } from "@/lib/physicalMedia";

// Flipping through a crate.
//
// One sleeve at a time, face on, in an order nobody chose. The two
// gestures are the two gestures a crate has: put it back, or take it.
// There is no rating, no "not for me, show me why", no thumbs - a record
// shop has never once asked you to explain a pass.

type SleeveInfo = {
  artworkUrl: string | null;
  previewUrl: string | null;
  trackUrl: string | null;
  /** The year the catalogue has for it, once it has been asked. */
  year?: number | null;
};

// One shared player, same reason as the discovery rails: two records
// playing at once on a page about listening is the thing that must not
// happen.
let audio: HTMLAudioElement | null = null;

function playClip(url: string, onStop: () => void) {
  if (!audio) audio = new Audio();
  audio.onended = onStop;
  audio.onerror = onStop;
  audio.src = url;
  void audio.play().catch(onStop);
}

function stopClip() {
  audio?.pause();
}

export function Crate({ sleeves, emptyNote }: { sleeves: Sleeve[]; emptyNote: string }) {
  const [index, setIndex] = useState(0);
  const [kept, setKept] = useState<Sleeve[]>([]);
  const [playing, setPlaying] = useState(false);
  const [info, setInfo] = useState<Record<string, SleeveInfo>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const current = sleeves[index] ?? null;
  const next = sleeves[index + 1] ?? null;

  // The current sleeve, and the one behind it. Looking one ahead is what
  // makes the next record already have its cover by the time you get to
  // it, instead of every flip starting with a blank square.
  const pending = useRef(new Set<string>());
  // How many times a sleeve has been refused rather than answered, so a
  // throttle can be waited out without asking forever.
  const attempts = useRef(new Map<string, number>());
  // Bumped to run the effect again after a refusal.
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    for (const sleeve of [current, next]) {
      if (!sleeve || info[sleeve.key] || pending.current.has(sleeve.key)) continue;
      pending.current.add(sleeve.key);
      const params = new URLSearchParams({ title: sleeve.name, artist: sleeve.artist });
      const key = sleeve.key;
      const tries = attempts.current.get(key) ?? 0;
      fetch(`/api/crate/sleeve?${params.toString()}`)
        .then(async (res) => {
          // 503 means Apple was busy, not that the record has no cover.
          // Writing that down as an answer is what left blank sleeves in
          // the box permanently, so instead the record is un-marked and
          // asked for again in a moment. Three goes: a throttle clears
          // in seconds, and a crate that keeps asking forever is a crate
          // making the throttle worse.
          if (res.status === 503) {
            pending.current.delete(key);
            attempts.current.set(key, tries + 1);
            if (tries + 1 < 3) setTimeout(() => setRetry((n) => n + 1), 1400);
            return;
          }
          const data = (await res.json()) as SleeveInfo;
          attempts.current.delete(key);
          setInfo((prev) => ({ ...prev, [key]: data }));
        })
        .catch(() => {
          // A blank sleeve is a fine outcome. Marking it as looked-up
          // stops the same failing request firing on every render.
          setInfo((prev) => ({
            ...prev,
            [sleeve.key]: { artworkUrl: null, previewUrl: null, trackUrl: null },
          }));
        });
    }
  }, [current, next, info, retry]);

  // Whatever is in your hand stops when you put it down. Done here
  // rather than in an effect on `index`: both ways of moving on go
  // through this function, and an effect would cost an extra render to
  // reach the same state.
  function flip() {
    stopClip();
    setPlaying(false);
    setSaveError(null);
    setIndex((i) => i + 1);
  }

  async function keep() {
    if (!current) return;
    setSaving(true);
    setSaveError(null);
    const form = new FormData();
    form.set("media_type", current.kind === "film" ? "movie_tv" : "music");
    form.set("title", current.name);
    form.set("subtitle", current.artist);
    form.set("image_url", info[current.key]?.artworkUrl ?? current.imageUrl ?? "");
    const result: QueueState = await addToQueue({}, form);
    setSaving(false);
    // Taking a record and being told nothing happened is worse than
    // being told why, so a failed save keeps the sleeve in your hand.
    if (result.error) {
      setSaveError(result.error);
      return;
    }
    setKept((k) => [...k, current]);
    flip();
  }

  if (sleeves.length === 0) {
    return <div className="crate-empty">{emptyNote}</div>;
  }

  if (!current) {
    return (
      <div className="crate-done">
        <p className="crate-done-line">
          That&apos;s the whole crate. {kept.length === 0
            ? "Nothing took your fancy. The next one is a different box."
            : `You pulled ${kept.length} out.`}
        </p>
        {kept.length > 0 && (
          <ul className="crate-kept">
            {kept.map((sleeve) => (
              <li key={sleeve.key}>
                <b>{sleeve.name}</b> <span>{sleeve.artist}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="crate-done-actions">
          {kept.length > 0 && <Link href="/queue" className="btn">Put them on your shelf</Link>}
          {/* A whole page reload, deliberately: the seed is minute-based,
              so this is the only way to genuinely get a different box. */}
          <a href="/crate" className="crate-again">Dig through another crate</a>
        </div>
      </div>
    );
  }

  const currentInfo = info[current.key];
  // The record in your hand is the one that has been looked up, so it is
  // the one that can be drawn as the object it actually was rather than
  // as a hash of its title. The rest of the box behind it has not been
  // looked up and keeps the hash, which is what the hash is for.
  const currentYear = currentInfo?.year ?? current.year;
  const art = currentInfo?.artworkUrl ?? current.imageUrl;
  const clip = currentInfo?.previewUrl ?? null;

  return (
    <div className="crate">
      {/* The record in your hand, held up in front of the crate it came
          out of. The box sits under it holding the rest, with their tops
          showing above the front board.
          Drawn this way round because a sleeve INSIDE the box turns the
          crate into a picture frame: you cannot see the records at all,
          and the box reads as a border rather than as a container. */}
      <div
        className={`crate-stack fmt-${
          current.kind === "film" ? "case" : formatFor(current.key, currentYear)
        }`}
      >
        <div className="crate-sleeve">
          {/* A film plays its trailer where a record plays its clip, in
              the sleeve rather than anywhere else, because the whole
              gesture of this page is that the thing in your hand is the
              thing you are deciding about. */}
          {current.kind === "film" && playing && current.videoId ? (
            <iframe
              src={`https://www.youtube.com/embed/${current.videoId}?autoplay=1&rel=0`}
              title={`${current.name} trailer`}
              allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : art ? (
            <img src={art} alt="" />
          ) : (
            // Three states, not two: a cover on its way and a record the
            // catalogue does not have looked identical here, which is
            // the same thing that made the shelves feel stuck.
            <div
              className={`crate-blank${info[current.key] ? "" : " waiting"}`}
              aria-busy={info[current.key] ? undefined : true}
              aria-label={info[current.key] ? undefined : `Finding the cover for ${current.name}`}
            >
              <span />
            </div>
          )}

          {current.kind === "film" && current.videoId && (
            <button
              type="button"
              className={`crate-play${playing ? " playing" : ""}`}
              onClick={() => setPlaying(!playing)}
            >
              {playing ? "Stop" : "Trailer"}
            </button>
          )}

          {current.kind !== "film" && clip && (
            <button
              type="button"
              className={`crate-play${playing ? " playing" : ""}`}
              onClick={() => {
                if (playing) {
                  stopClip();
                  setPlaying(false);
                } else {
                  setPlaying(true);
                  playClip(clip, () => setPlaying(false));
                }
              }}
            >
              {playing ? "Stop" : "Hear it"}
            </button>
          )}
        </div>
      </div>

      {/* The crate itself, with the records still in it. Their tops show
          above the front board, which is the whole reason a crate looks
          like a crate rather than like a box. */}
      <div className="crate-box" aria-hidden="true">
        <div className="crate-fill">
          {/* Twenty six, not fourteen. Fourteen edges across a crate this
              wide left dark gaps between them and the whole thing read as
              a row of matchsticks standing in a box. A crate is full. */}
          {sleeves.slice(index + 1, index + 27).map((sleeve, i) => {
            // The cover the record already has. Only the one in your
            // hand gets looked up, so most of the box is drawn from
            // whatever the source supplied - and anything with none
            // draws as the printed board and paper label the rest of the
            // site uses for a record with no picture, rather than as a
            // coloured card edge.
            const art = info[sleeve.key]?.artworkUrl ?? sleeve.imageUrl;
            return (
              <span
                key={sleeve.key}
                className={`crate-divider fmt-${
                  sleeve.kind === "film" ? "case" : formatForKey(sleeve.key)
                }${art ? "" : " blank"}`}
                style={{
                  ["--i" as string]: i,
                  ...(art ? { backgroundImage: `url(${art})` } : {}),
                }}
              />
            );
          })}
        </div>
        <div className="crate-lip" />
      </div>

      <div className="crate-label">
        <b>{current.name}</b>
        <span className="crate-by">{current.artist}</span>
        {/* No rating, no match score, no reason. The crate has no opinion
            about this record and saying so is the point. */}
        <span className="crate-format">
          {current.kind === "film" ? "Film" : FORMAT_LABELS[formatFor(current.key, currentYear)]}
        </span>
      </div>

      {saveError && <div className="form-error">{saveError}</div>}

      <div className="crate-hands">
        <button type="button" className="crate-pass" onClick={flip}>
          Put it back
        </button>
        <button type="button" className="crate-keep" onClick={keep} disabled={saving}>
          {saving ? "Taking it" : "Take it"}
        </button>
      </div>

      <div className="crate-count">
        {index + 1} of {sleeves.length}
        {kept.length > 0 && `, ${kept.length} taken`}
      </div>
    </div>
  );
}
