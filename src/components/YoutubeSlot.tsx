"use client";

import { useEffect, useRef, useState } from "react";

// A YouTube embed that has somewhere to go when it will not play.
//
// The profiles were showing a red error box where a video should be.
// That is not the daily quota - an embed costs no quota at all - it is
// YouTube refusing to play THIS video in an iframe, which happens for
// reasons nobody here controls: the uploader disabled embedding, the
// label blocked it in some countries, the video was taken down, or the
// id was resolved back when it pointed at something else.
//
// No amount of retrying fixes any of those. What fixes the EXPERIENCE is
// having something else to show, and every YouTube video has one thing
// that always loads and needs no key, no quota and no permission: its
// thumbnail. So a video that will not play becomes a picture of itself
// with a link on it, which is a profile that looks finished rather than
// a profile with a red box on it.
//
// The poster also sits underneath from the very first paint, so the slot
// is never empty while the iframe is still connecting - there is no
// moment where somebody sees nothing.

/** Codes YouTube sends when a video cannot be played here. */
const UNPLAYABLE = new Set([2, 5, 100, 101, 150]);

export function YoutubeSlot({
  videoId,
  title,
  className,
  /** Muted looping wallpaper, as the profile slots use. */
  ambient = false,
  /** Starts on its own. Used by the profile song, which its owner opted into. */
  autoplay = false,
}: {
  videoId: string;
  title: string;
  className?: string;
  ambient?: boolean;
  autoplay?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const frame = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    // YouTube posts its player events to the parent window when the
    // embed carries enablejsapi=1. Read directly rather than loading
    // their IFrame API script: this needs one event out of it, and
    // pulling in a third-party script to hear about a failure is a lot
    // of weight for a fallback.
    function onMessage(event: MessageEvent) {
      if (!/^https:\/\/(www\.)?youtube(-nocookie)?\.com$/.test(event.origin)) return;
      if (frame.current && event.source !== frame.current.contentWindow) return;
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.event === "onError" || data?.event === "infoDelivery") {
          const code = Number(data?.info?.errorCode ?? data?.info);
          if (UNPLAYABLE.has(code)) setFailed(true);
        }
      } catch {
        // Not one of theirs, or not JSON. Nothing to do.
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Always loads, always free. hqdefault exists for every video on
  // YouTube including ones that refuse to be embedded.
  const poster = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  if (failed) {
    return (
      <a
        className={className}
        href={`https://www.youtube.com/watch?v=${videoId}`}
        target="_blank"
        rel="noopener noreferrer"
        title={`${title}, opens on YouTube`}
        style={{
          backgroundImage: `url(${poster})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          display: "block",
        }}
        aria-label={`${title}, watch on YouTube`}
      />
    );
  }

  const params = new URLSearchParams({
    enablejsapi: "1",
    playsinline: "1",
    modestbranding: "1",
    rel: "0",
    ...(ambient
      ? { autoplay: "1", mute: "1", loop: "1", playlist: videoId, controls: "0" }
      : autoplay
        ? { autoplay: "1" }
        : {}),
  });

  return (
    <span
      className={className}
      // The poster sits behind the player from the first paint, so the
      // slot is never a blank rectangle while the iframe connects.
      style={{
        backgroundImage: `url(${poster})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "block",
      }}
    >
      <iframe
        ref={frame}
        src={`https://www.youtube.com/embed/${videoId}?${params.toString()}`}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        title={title}
        tabIndex={ambient ? -1 : undefined}
        style={{ display: "block", width: "100%", height: "100%", border: 0 }}
      />
    </span>
  );
}
