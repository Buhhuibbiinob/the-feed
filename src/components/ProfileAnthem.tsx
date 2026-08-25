"use client";

import { useEffect, useRef, useState } from "react";

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

  // Once the visitor has interacted anywhere on the page, the browser will
  // usually allow sound - so the first click is used to lift the mute
  // without needing them to find the button.
  useEffect(() => {
    if (!autoplay) return;
    function onFirstGesture() {
      document.removeEventListener("pointerdown", onFirstGesture);
    }
    document.addEventListener("pointerdown", onFirstGesture, { once: true });
    return () => document.removeEventListener("pointerdown", onFirstGesture);
  }, [autoplay]);

  function command(func: "unMute" | "mute" | "playVideo" | "pauseVideo") {
    frameRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args: [] }),
      "*"
    );
  }

  function toggleSound() {
    if (muted) {
      command("unMute");
      command("playVideo");
      setMuted(false);
      setPlaying(true);
    } else {
      command("mute");
      setMuted(true);
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
          {muted ? "🔇 Tap for sound" : "🔊 Sound on"}
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
