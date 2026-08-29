"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// If a visitor has turned the sound off once, later profiles in the same
// visit stay quiet. Autoplay is the point, but overriding somebody who
// has explicitly said no is a different thing from starting by default.
const OPTED_OUT = "feedback-anthem-muted";

/**
 * The profile song, autoplaying on every browser.
 *
 * Straight autoplay with sound is blocked by Chrome, Safari and Firefox
 * alike - that's a platform rule, not a setting, and no amount of code
 * gets around it. What every browser *does* allow is autoplay while muted.
 * So the track starts on its own everywhere, and one tap turns the sound
 * on. That's the Myspace behaviour minus the part modern browsers refuse.
 *
 * Unmuting talks to the YouTube iframe over postMessage (enablejsapi),
 * which needs no extra script.
 */
export function ProfileAnthem({
  youtubeVideoId,
  spotifyTrackId,
  title,
  artist,
  thumbnailUrl,
  autoplay,
}: {
  youtubeVideoId: string | null;
  spotifyTrackId: string | null;
  title: string;
  artist: string | null;
  thumbnailUrl: string | null;
  autoplay: boolean;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(autoplay);

  const command = useCallback(
    (func: "unMute" | "mute" | "playVideo" | "pauseVideo") => {
      frameRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func, args: [] }),
        "*"
      );
    },
    []
  );

  // Lift the mute on the first interaction anywhere on the page.
  //
  // This effect existed and did nothing: the handler removed its own
  // listener and returned. So the song did autoplay - silently - and
  // stayed silent until you found the Sound button, which is
  // indistinguishable from "the music does not play".
  //
  // Browsers block audible autoplay outright; that is a platform rule,
  // not a setting. Muted autoplay is allowed everywhere, and after a
  // gesture the same page may unmute. So: start muted, and take the
  // first tap - any tap, anywhere - as the permission to turn it up.
  useEffect(() => {
    if (!autoplay) return;
    try {
      if (sessionStorage.getItem(OPTED_OUT) === "1") return;
    } catch {
      // Storage blocked; treat it as no opt-out on record.
    }

    function onFirstGesture() {
      // The iframe may still be handshaking, so the command is sent now
      // and again shortly after. Both are cheap and a duplicate unMute
      // is a no-op.
      command("unMute");
      command("playVideo");
      window.setTimeout(() => {
        command("unMute");
        command("playVideo");
      }, 350);
      setMuted(false);
      setPlaying(true);
    }

    document.addEventListener("pointerdown", onFirstGesture, { once: true });
    document.addEventListener("keydown", onFirstGesture, { once: true });
    return () => {
      document.removeEventListener("pointerdown", onFirstGesture);
      document.removeEventListener("keydown", onFirstGesture);
    };
  }, [autoplay, command]);

  function toggleSound() {
    if (muted) {
      command("unMute");
      command("playVideo");
      setMuted(false);
      setPlaying(true);
      try {
        sessionStorage.removeItem(OPTED_OUT);
      } catch {
        // Nothing to do.
      }
    } else {
      command("mute");
      setMuted(true);
      // Remembered for the rest of the visit, so every profile after
      // this one does not turn itself back up.
      try {
        sessionStorage.setItem(OPTED_OUT, "1");
      } catch {
        // Nothing to do.
      }
    }
  }

  if (spotifyTrackId && !youtubeVideoId) {
    // Spotify's embed refuses programmatic autoplay outright, so it's shown
    // as a normal player rather than pretending otherwise.
    return (
      <div className="anthem">
        <iframe
          title={title}
          src={`https://open.spotify.com/embed/track/${spotifyTrackId}?utm_source=generator`}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className="anthem-spotify"
        />
      </div>
    );
  }

  if (!youtubeVideoId) return null;

  const params = new URLSearchParams({
    enablejsapi: "1",
    playsinline: "1",
    rel: "0",
    ...(autoplay ? { autoplay: "1", mute: "1", loop: "1", playlist: youtubeVideoId } : {}),
  });

  return (
    <div className="anthem">
      <div className="anthem-bar">
        {thumbnailUrl && <img src={thumbnailUrl} alt="" className="anthem-art" />}
        <span className={`anthem-eq${playing && !muted ? " playing" : ""}`} aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="anthem-meta">
          <b>{title}</b>
          {artist && <span className="sub">{artist}</span>}
        </span>
        <button type="button" className="anthem-sound" onClick={toggleSound}>
          {muted ? "Sound off" : "Sound on"}
        </button>
      </div>
      <iframe
        ref={frameRef}
        title={title}
        src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}?${params.toString()}`}
        allow="autoplay; encrypted-media; picture-in-picture"
        className="anthem-frame"
      />
    </div>
  );
}
