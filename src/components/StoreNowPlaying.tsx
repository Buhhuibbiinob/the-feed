"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The profile song, in iTunes' display.
//
// The reference window has one readout across the top of it showing what
// is playing. That is exactly what a profile song is, so it goes there
// rather than in a widget of its own - which is what it used to be, and
// which is the shape that made it read as a 2005 profile.
//
// AUTOPLAY, HONESTLY. Every browser blocks audible autoplay outright;
// that is a platform rule, not a setting anyone can turn off. Muted
// autoplay is allowed everywhere, and after any gesture the same page
// may unmute. So the song starts playing muted and takes the first tap
// anywhere on the page as permission to turn it up. Anything else would
// be a song that silently does not play, which is worse than no song.

const OPTED_OUT = "feedback:song-off";

export function StoreNowPlaying({
  youtubeVideoId,
  title,
  artist,
  autoplay,
}: {
  youtubeVideoId: string | null;
  title: string | null;
  artist: string | null;
  autoplay: boolean;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [muted, setMuted] = useState(true);
  const [started, setStarted] = useState(autoplay);

  const command = useCallback((func: "unMute" | "mute" | "playVideo" | "pauseVideo") => {
    frameRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args: [] }),
      "*"
    );
  }, []);

  useEffect(() => {
    if (!autoplay || !youtubeVideoId) return;
    try {
      if (sessionStorage.getItem(OPTED_OUT) === "1") return;
    } catch {
      /* storage blocked; no opt-out on record */
    }

    function onFirstGesture() {
      // The iframe may still be handshaking, so the command goes twice.
      // A duplicate unMute is a no-op.
      command("unMute");
      command("playVideo");
      window.setTimeout(() => {
        command("unMute");
        command("playVideo");
      }, 350);
      setMuted(false);
      setStarted(true);
    }

    document.addEventListener("pointerdown", onFirstGesture, { once: true });
    document.addEventListener("keydown", onFirstGesture, { once: true });
    return () => {
      document.removeEventListener("pointerdown", onFirstGesture);
      document.removeEventListener("keydown", onFirstGesture);
    };
  }, [autoplay, youtubeVideoId, command]);

  if (!youtubeVideoId) return null;

  function toggle() {
    if (muted || !started) {
      command("unMute");
      command("playVideo");
      setMuted(false);
      setStarted(true);
      try {
        sessionStorage.removeItem(OPTED_OUT);
      } catch {
        /* nothing to clear */
      }
    } else {
      command("pauseVideo");
      command("mute");
      setMuted(true);
      try {
        sessionStorage.setItem(OPTED_OUT, "1");
      } catch {
        /* the pause still holds for this page */
      }
    }
  }

  return (
    <div className="store-display">
      <button
        type="button"
        className="store-display-btn"
        onClick={toggle}
        aria-label={muted ? "Play profile song" : "Mute profile song"}
      >
        {muted ? "▶" : "❚❚"}
      </button>
      <span className="store-display-text">
        <b>{title ?? "Profile song"}</b>
        {artist && <span>{artist}</span>}
      </span>
      <span className="store-display-state" aria-hidden="true">
        {muted ? "muted" : "playing"}
      </span>
      {/* 1px rather than display:none - a hidden iframe is not allowed to
          play in some browsers, and this has to actually run. */}
      <iframe
        ref={frameRef}
        className="store-display-frame"
        src={`https://www.youtube.com/embed/${youtubeVideoId}?enablejsapi=1&autoplay=1&mute=1&loop=1&playlist=${youtubeVideoId}&controls=0&playsinline=1`}
        allow="autoplay; encrypted-media"
        title="Profile song"
      />
    </div>
  );
}
