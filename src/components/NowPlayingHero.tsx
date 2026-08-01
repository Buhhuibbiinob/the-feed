"use client";

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function stars(rating: number) {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
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
    <div className="sk-np-card">
      <div className="sk-np-title">{title}</div>
      {(artist || rating) && (
        <div className="sk-np-subtitle">
          {artist}
          {artist && rating ? " · " : ""}
          {rating ? stars(rating) : ""}
        </div>
      )}
      <div
        className="sk-np-art"
        style={coverUrl ? { backgroundImage: `url(${coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      />
      <div className="sk-np-transport">
        <button className="t-btn big" onClick={scrollToPlayer} aria-label="Play">
          <PlayIcon />
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
    </div>
  );
}
