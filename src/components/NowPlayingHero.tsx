"use client";

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function NowPlayingHero({
  coverUrl,
  title,
  artist,
  rating,
  targetId,
}: {
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
    <div className="now-playing-hero">
      <div
        className="now-playing-art"
        style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined}
      />
      <div className="now-playing-title">
        {title}
        {artist && <span className="now-playing-artist"> - {artist}</span>}
      </div>
      {rating && <div className="now-playing-stars">{"★".repeat(rating)}{"☆".repeat(5 - rating)}</div>}
      <div className="scrub-track">
        <div className="scrub-fill" />
        <div className="scrub-knob" />
      </div>
      <div className="now-playing-transport">
        <button className="t-btn big" onClick={scrollToPlayer} aria-label="Play">
          <PlayIcon />
        </button>
      </div>
    </div>
  );
}
