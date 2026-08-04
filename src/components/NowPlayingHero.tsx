"use client";

import { ShareButton } from "@/components/ShareButton";
import { Stars } from "@/components/Stars";

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function RepeatIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z" />
    </svg>
  );
}

function ShuffleIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M14.83 13.41 16.25 12l1.42 1.42a1 1 0 0 1 0 1.41L15.25 17.4l-1.41-1.41 1.17-1.17-1.18-1.18ZM10.59 9.17 9.17 10.59 6 7.42V6h1.42l3.17 3.17ZM17.67 6H16v1.42l1.42 1.41 1.41-1.41L17.67 6ZM6 18h1.42l7.41-7.42-1.41-1.41L6.58 16.58H6V18Z" />
    </svg>
  );
}

export function NowPlayingHero({
  postId,
  coverUrl,
  title,
  artist,
  rating,
  targetId,
}: {
  postId: string;
  coverUrl: string | null;
  title: string;
  artist: string | null;
  rating: number | null;
  targetId: string;
}) {
  function scrollToPlayer() {
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="sk-np-card">
      <div className="sk-np-title">{title}</div>
      {(artist || rating) && (
        <div className="sk-np-subtitle">
          {artist}
          {artist && rating ? " · " : ""}
          <Stars rating={rating} />
        </div>
      )}
      <div
        className="sk-np-art"
        style={coverUrl ? { backgroundImage: `url(${coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      />
      <div className="sk-np-transport">
        <button className="circle-icon-btn neutral" disabled aria-label="Repeat (not available)" title="Repeat">
          <RepeatIcon />
        </button>
        <button className="t-btn big" onClick={scrollToPlayer} aria-label="Play">
          <PlayIcon />
        </button>
        <button className="circle-icon-btn neutral" disabled aria-label="Shuffle (not available)" title="Shuffle">
          <ShuffleIcon />
        </button>
      </div>
      <div className="sk-np-scrub-row">
        <span>0:00</span>
        <div className="sk-np-scrub-track">
          <div className="sk-np-scrub-fill" />
          <div className="sk-np-scrub-knob" />
        </div>
        <span>--:--</span>
      </div>
      <div className="sk-np-share-row">
        <ShareButton postId={postId} title={artist ? `${title} - ${artist}` : title} />
      </div>
    </div>
  );
}
