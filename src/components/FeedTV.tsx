"use client";

import { useEffect, useRef, useState } from "react";

export type FeedTvClip = {
  id: string;
  title: string;
  artist: string | null;
  username: string;
  youtubeVideoId: string;
};

type YTPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  mute: () => void;
  unMute: () => void;
  loadVideoById: (videoId: string) => void;
  destroy: () => void;
};

type YTPlayerEvent = { data: number };

type YTNamespace = {
  Player: new (
    el: HTMLElement,
    options: {
      width: string;
      height: string;
      videoId: string;
      playerVars: Record<string, number>;
      events: { onStateChange: (e: YTPlayerEvent) => void };
    }
  ) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
};

declare global {
  interface Window {
    YT: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function loadYouTubeAPI(): Promise<YTNamespace> {
  return new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevCallback?.();
      resolve(window.YT);
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  });
}

const STATIC_DURATION_MS = 400;

export function FeedTV({ clips, heading = "TV" }: { clips: FeedTvClip[]; heading?: string }) {
  const playerElRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [switching, setSwitching] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (clips.length === 0) return;
    let destroyed = false;

    loadYouTubeAPI().then((YT) => {
      if (destroyed || !playerElRef.current) return;
      playerRef.current = new YT.Player(playerElRef.current, {
        width: "100%",
        height: "100%",
        videoId: clips[0].youtubeVideoId,
        playerVars: { autoplay: 1, mute: 1, controls: 1, rel: 0, playsinline: 1 },
        events: {
          onStateChange: (e: YTPlayerEvent) => {
            if (e.data === YT.PlayerState.ENDED) {
              setIndex((i) => (i + 1) % clips.length);
            } else if (e.data === YT.PlayerState.PLAYING) {
              setPaused(false);
            } else if (e.data === YT.PlayerState.PAUSED) {
              setPaused(true);
            }
          },
        },
      });
    });

    return () => {
      destroyed = true;
      playerRef.current?.destroy?.();
    };
    // The player is created once per clip list and driven afterward via
    // loadVideoById (see the index effect below) - recreating it on every
    // index change would restart YouTube's API handshake each time.
  }, [clips]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setSwitching(true);
    const timeout = setTimeout(() => setSwitching(false), STATIC_DURATION_MS);
    const player = playerRef.current;
    const clip = clips[index];
    if (player?.loadVideoById && clip) {
      player.loadVideoById(clip.youtubeVideoId);
      if (muted) player.mute();
    }
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  if (clips.length === 0) return null;

  function togglePause() {
    if (paused) playerRef.current?.playVideo?.();
    else playerRef.current?.pauseVideo?.();
  }

  function toggleMute() {
    if (muted) playerRef.current?.unMute?.();
    else playerRef.current?.mute?.();
    setMuted((m) => !m);
  }

  function skipNext() {
    setIndex((i) => (i + 1) % clips.length);
  }

  return (
    <div className="panel feedtv-panel">
      <div className="panel-head">
        <span className="tab-main">{heading}</span>
        <span className="feedtv-live">● LIVE</span>
      </div>
      <div className="feedtv-body">
        <div className="feedtv-tv">
          <div className="feedtv-tv-antenna feedtv-tv-antenna-left" />
          <div className="feedtv-tv-antenna feedtv-tv-antenna-right" />
          <div className="feedtv-tv-frame">
            <div className="feedtv-tv-led" />
            <div className="feedtv-player">
              <div ref={playerElRef} className="feedtv-iframe-target" />
              {switching && <div className="feedtv-static" />}
              <div className="feedtv-controls">
                <button className="feedtv-ctrl-btn" onClick={togglePause} aria-label={paused ? "Play" : "Pause"}>
                  <span>{paused ? "▶" : "❚❚"}</span>
                </button>
                <button className="feedtv-ctrl-btn" onClick={skipNext} aria-label="Skip to next">
                  <span>⏭</span>
                </button>
                <button className="feedtv-ctrl-btn" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>
                  <span>{muted ? "🔇" : "🔊"}</span>
                </button>
              </div>
            </div>
            <div className="feedtv-tv-speaker">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} />
              ))}
            </div>
          </div>
          <div className="feedtv-tv-stand" />
        </div>
        <div className="feedtv-upnext">
          <div className="feedtv-upnext-label">Up Next</div>
          <div className="feedtv-upnext-strip">
            {clips.map((clip, i) => (
              <button
                key={clip.id}
                type="button"
                className={`feedtv-thumb ${i === index ? "active" : ""}`}
                onClick={() => setIndex(i)}
              >
                <img src={`https://img.youtube.com/vi/${clip.youtubeVideoId}/mqdefault.jpg`} alt="" />
                <span className="feedtv-thumb-title">{clip.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
