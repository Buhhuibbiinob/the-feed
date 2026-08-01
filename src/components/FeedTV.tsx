"use client";

import Link from "next/link";
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
  getCurrentTime?: () => number;
  getDuration?: () => number;
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

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}
function SkipIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M6 6h2v12H6zm12 0L8 12l10 6z" />
    </svg>
  );
}

type Tab = "playing" | "suggested" | "comments";

export function FeedTV({ clips, heading = "TV" }: { clips: FeedTvClip[]; heading?: string }) {
  const playerElRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [tab, setTab] = useState<Tab>("playing");
  const [progress, setProgress] = useState({ current: 0, duration: 0 });
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
    const timer = setInterval(() => {
      const player = playerRef.current;
      if (!player?.getCurrentTime || !player.getDuration) return;
      setProgress({ current: player.getCurrentTime(), duration: player.getDuration() });
    }, 500);
    return () => clearInterval(timer);
  }, []);

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

  const current = clips[index];
  const scrubPct = progress.duration > 0 ? Math.min(100, (progress.current / progress.duration) * 100) : 0;

  return (
    <div className="panel feedtv-panel">
      <div className="panel-head tabbed">
        <span className="panel-head-tab tab-main">{heading}</span>
        <span className="feedtv-live">● LIVE</span>
      </div>
      <div className="feedtv-body">
        <div className="yt-shell">
          <div className="yt-topbar">
            The Feed<span className="yt-red">TV</span>
          </div>
          <div className="yt-rate-row">
            <button className="yt-rate-btn" onClick={togglePause} aria-label={paused ? "Play" : "Pause"}>
              {paused ? <PlayIcon /> : <PauseIcon />}
            </button>
            <button className="yt-rate-btn" onClick={skipNext} aria-label="Skip to next">
              <SkipIcon />
            </button>
            <button className="yt-rate-btn text" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>
              {muted ? "Unmute" : "Mute"}
            </button>
          </div>
          <div className="yt-video">
            <div ref={playerElRef} className="feedtv-iframe-target" />
            {switching && <div className="feedtv-static" />}
          </div>
          <div className="yt-scrub-row">
            <div className="time">{formatTime(progress.current)}</div>
            <div className="yt-red-track">
              <div className="yt-red-fill" style={{ width: `${scrubPct}%` }} />
              <div className="yt-red-knob" style={{ left: `${scrubPct}%` }} />
            </div>
            <div className="time">{formatTime(progress.duration)}</div>
          </div>
          <div className="yt-tabs">
            <div className={tab === "playing" ? "active" : ""} onClick={() => setTab("playing")}>
              Now Playing
            </div>
            <div className={tab === "suggested" ? "active" : ""} onClick={() => setTab("suggested")}>
              Suggested
            </div>
            <div className={tab === "comments" ? "active" : ""} onClick={() => setTab("comments")}>
              Comments
            </div>
          </div>
          {tab === "playing" && (
            <div className="yt-tab-panel">
              <b>{current.title}</b>
              {current.artist && <span> - {current.artist}</span>}
              <span className="yt-tab-sub">posted by {current.username}</span>
            </div>
          )}
          {tab === "suggested" && (
            <div className="feedtv-upnext">
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
          )}
          {tab === "comments" && (
            <div className="yt-tab-panel">
              <Link href={`/post/${current.id}`}>View the full review &amp; comments &rarr;</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
