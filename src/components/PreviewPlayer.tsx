// The embed is framed as a little media player window: a brushed chrome
// strip across the top carrying what's loaded, then the iframe recessed
// into the body below it.
//
// The strip deliberately has no play button. The reference screenshots all
// show one, but the actual transport controls belong to Spotify's and
// YouTube's own embeds inside the iframe, and a glossy button that looked
// pressable while doing nothing would be a worse experience than no button
// at all. The strip carries a non-interactive media glyph instead.
function PlayerFrame({
  kind,
  label,
  children,
}: {
  kind: "audio" | "video";
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`preview-player preview-player-${kind}`}>
      <div className="preview-player-strip">
        <span className="preview-player-glyph" aria-hidden="true" />
        <span className="preview-player-label">{label}</span>
        <span className="preview-player-kind">{kind === "audio" ? "Preview" : "Video"}</span>
      </div>
      <div className="preview-player-screen">{children}</div>
    </div>
  );
}

export function PreviewPlayer({
  spotifyTrackId,
  youtubeVideoId,
  label,
}: {
  spotifyTrackId?: string | null;
  youtubeVideoId?: string | null;
  label: string;
}) {
  if (spotifyTrackId) {
    return (
      <PlayerFrame kind="audio" label={label}>
        <iframe
          title={`${label} preview`}
          src={`https://open.spotify.com/embed/track/${spotifyTrackId}?utm_source=generator&theme=0`}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      </PlayerFrame>
    );
  }

  if (youtubeVideoId) {
    return (
      <PlayerFrame kind="video" label={label}>
        <iframe
          title={`${label} trailer`}
          src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </PlayerFrame>
    );
  }

  return null;
}
