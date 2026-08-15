"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

export type FeedTvClip = {
  id: string;
  title: string;
  artist: string | null;
  youtubeVideoId: string;
  // Both null when the clip is a chart filler rather than something a
  // member actually posted, so the panel never implies a review exists.
  username: string | null;
  postId: string | null;
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
  seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
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

// Kept in localStorage rather than the profile: it's a per-device viewing
// preference (a phone and a desktop want different answers), and it costs
// no round trip or schema change.
const SIZES = [
  { id: "s", label: "S", width: 320 },
  { id: "m", label: "M", width: 420 },
  { id: "l", label: "L", width: 560 },
  { id: "xl", label: "XL", width: 760 },
] as const;
type SizeId = (typeof SIZES)[number]["id"];
const SIZE_KEY = "feedtv-size";
const DEFAULT_SIZE: SizeId = "m";

// A tiny external store rather than reading localStorage into state in an
// effect. useSyncExternalStore is built for browser-only values like this:
// the server snapshot is the default, the client snapshot is what's stored,
// and React reconciles the two after hydration without a mismatch warning
// or a synchronous setState during mount.
let cachedSize: SizeId | null = null;
const sizeListeners = new Set<() => void>();

function readStoredSize(): SizeId {
  if (cachedSize) return cachedSize;
  try {
    const saved = localStorage.getItem(SIZE_KEY);
    cachedSize = saved && SIZES.some((s) => s.id === saved) ? (saved as SizeId) : DEFAULT_SIZE;
  } catch {
    // Private browsing or storage disabled - the default is fine.
    cachedSize = DEFAULT_SIZE;
  }
  return cachedSize;
}

function writeStoredSize(id: SizeId) {
  cachedSize = id;
  try {
    localStorage.setItem(SIZE_KEY, id);
  } catch {
    // Not worth surfacing; the choice still applies for this session.
  }
  for (const listener of sizeListeners) listener();
}

function subscribeSize(onChange: () => void) {
  sizeListeners.add(onChange);
  return () => {
    sizeListeners.delete(onChange);
  };
}

export function FeedTV({ clips }: { clips: FeedTvClip[] }) {
  const playerElRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [tab, setTab] = useState<Tab>("playing");
  const [progress, setProgress] = useState({ current: 0, duration: 0 });
  const size = useSyncExternalStore(subscribeSize, readStoredSize, () => DEFAULT_SIZE);
  const isFirstRender = useRef(true);
  // Scrub state lives up here with the other hooks: everything below the
  // `clips.length === 0` early return runs conditionally, and a hook there
  // changes call order between renders.
  const trackRef = useRef<HTMLDivElement>(null);
  const [scrubbing, setScrubbing] = useState<number | null>(null);

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
  // The scrub bar was painted from progress but had no handlers at all, so
  // it looked like a control and did nothing. Pointer events give it drag,
  // click-to-seek and keyboard, and work for mouse and touch from one path.
  const fractionFromEvent = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return 0;
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  };

  const seekToFraction = (fraction: number) => {
    const player = playerRef.current;
    if (!player?.seekTo || progress.duration <= 0) return;
    player.seekTo(fraction * progress.duration, true);
    setProgress((p) => ({ ...p, current: fraction * p.duration }));
  };

  function onScrubDown(e: React.PointerEvent<HTMLDivElement>) {
    if (progress.duration <= 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrubbing(fractionFromEvent(e.clientX));
  }
  function onScrubMove(e: React.PointerEvent<HTMLDivElement>) {
    if (scrubbing === null) return;
    setScrubbing(fractionFromEvent(e.clientX));
  }
  function onScrubUp(e: React.PointerEvent<HTMLDivElement>) {
    if (scrubbing === null) return;
    const fraction = fractionFromEvent(e.clientX);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setScrubbing(null);
    seekToFraction(fraction);
  }
  function onScrubKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (progress.duration <= 0) return;
    const step = e.shiftKey ? 30 : 5;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const delta = e.key === "ArrowRight" ? step : -step;
      const next = Math.min(progress.duration, Math.max(0, progress.current + delta));
      seekToFraction(next / progress.duration);
    }
  }

  // While dragging, the bar follows the finger rather than the player, so
  // it doesn't fight the once-a-second progress poll.
  const livePct = progress.duration > 0 ? Math.min(100, (progress.current / progress.duration) * 100) : 0;
  const scrubPct = scrubbing !== null ? scrubbing * 100 : livePct;

  const width = SIZES.find((s) => s.id === size)!.width;

  return (
    <div className="feedtv-standalone" style={{ maxWidth: width }}>
      <div className="yt-shell">
          {/* Brand plate on the left, then a recessed LCD showing what's on,
              the way an iTunes mini-player puts the track in a sunken screen
              rather than printing it on the chrome. */}
          <div className="yt-topbar">
            <span className="yt-brand">
              The Feed<span className="yt-red">TV</span>
            </span>
            <span className="yt-lcd">
              <span className="yt-lcd-scan" aria-hidden="true" />
              <span className="yt-lcd-text">
                <b>{current.title}</b>
                {current.artist && <span className="yt-lcd-artist">{current.artist}</span>}
              </span>
              <span className="yt-lcd-count" aria-hidden="true">
                {index + 1}/{clips.length}
              </span>
            </span>
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
            <div className="feedtv-size" role="group" aria-label="Player size">
              {SIZES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={size === s.id ? "active" : ""}
                  onClick={() => writeStoredSize(s.id)}
                  aria-pressed={size === s.id}
                  title={`${s.width}px wide`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="yt-video">
            <div ref={playerElRef} className="feedtv-iframe-target" />
            {switching && <div className="feedtv-static" />}
          </div>
          <div className="yt-scrub-row">
            <div className="time">{formatTime(progress.current)}</div>
            <div
              ref={trackRef}
              className={`yt-red-track ${scrubbing !== null ? "scrubbing" : ""}`}
              role="slider"
              tabIndex={0}
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={Math.round(progress.duration)}
              aria-valuenow={Math.round((scrubPct / 100) * progress.duration)}
              onPointerDown={onScrubDown}
              onPointerMove={onScrubMove}
              onPointerUp={onScrubUp}
              onPointerCancel={onScrubUp}
              onKeyDown={onScrubKey}
            >
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
              <span className="yt-tab-sub">
                {current.username ? `posted by ${current.username}` : "charting right now"}
              </span>
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
              {current.postId ? (
                <Link href={`/post/${current.postId}`}>View the full review &amp; comments &rarr;</Link>
              ) : (
                <Link href="/post/new">Nobody&apos;s reviewed this yet - be the first &rarr;</Link>
              )}
            </div>
          )}
      </div>
    </div>
  );
}
