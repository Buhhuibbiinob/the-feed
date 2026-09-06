"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { addToQueue, type QueueState } from "@/app/actions/queue";
import type { Sleeve } from "@/lib/crate";

// Flipping through a crate.
//
// One sleeve at a time, face on, in an order nobody chose. The two
// gestures are the two gestures a crate has: put it back, or take it.
// There is no rating, no "not for me, show me why", no thumbs - a record
// shop has never once asked you to explain a pass.

type SleeveInfo = { artworkUrl: string | null; previewUrl: string | null; trackUrl: string | null };

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
  useEffect(() => {
    for (const sleeve of [current, next]) {
      if (!sleeve || info[sleeve.key] || pending.current.has(sleeve.key)) continue;
      pending.current.add(sleeve.key);
      const params = new URLSearchParams({ title: sleeve.name, artist: sleeve.artist });
      fetch(`/api/crate/sleeve?${params.toString()}`)
        .then((res) => res.json())
        .then((data: SleeveInfo) => setInfo((prev) => ({ ...prev, [sleeve.key]: data })))
        .catch(() => {
          // A blank sleeve is a fine outcome. Marking it as looked-up
          // stops the same failing request firing on every render.
          setInfo((prev) => ({
            ...prev,
            [sleeve.key]: { artworkUrl: null, previewUrl: null, trackUrl: null },
          }));
        });
    }
  }, [current, next, info]);

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
    form.set("media_type", "music");
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
            ? "Nothing took your fancy - the next one is a different box."
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
          {kept.length > 0 && <Link href="/queue" className="btn">See them in Up Next</Link>}
          {/* A whole page reload, deliberately: the seed is minute-based,
              so this is the only way to genuinely get a different box. */}
          <a href="/crate" className="crate-again">Dig through another crate</a>
        </div>
      </div>
    );
  }

  const currentInfo = info[current.key];
  const art = currentInfo?.artworkUrl ?? current.imageUrl;
  const clip = currentInfo?.previewUrl ?? null;

  return (
    <div className="crate">
      <div className="crate-stack">
        {/* The next sleeve, just visible behind this one. A stack with
            nothing behind it does not read as a crate - it reads as one
            record on a table. */}
        {next && <div className="crate-behind" aria-hidden="true" />}

        <div className="crate-sleeve">
          {art ? (
            // Cover art comes from Apple's and Last.fm's CDNs, which are
            // not in next.config's image allowlist.
            <img src={art} alt="" />
          ) : (
            <div className="crate-blank" aria-hidden="true">
              <span />
            </div>
          )}

          {clip && (
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

      <div className="crate-label">
        <b>{current.name}</b>
        <span>{current.artist}</span>
        {/* No rating, no match score, no reason. The crate has no opinion
            about this record and saying so is the point. */}
      </div>

      {saveError && <div className="form-error">{saveError}</div>}

      <div className="crate-hands">
        <button type="button" className="crate-pass" onClick={flip}>
          Put it back
        </button>
        <button type="button" className="crate-keep" onClick={keep} disabled={saving}>
          {saving ? "Taking it…" : "Take it"}
        </button>
      </div>

      <div className="crate-count">
        {index + 1} of {sleeves.length}
        {kept.length > 0 && ` · ${kept.length} taken`}
      </div>
    </div>
  );
}
