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
      <div className="preview-player preview-player-audio">
        <iframe
          title={`${label} preview`}
          src={`https://open.spotify.com/embed/track/${spotifyTrackId}?utm_source=generator&theme=0`}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        />
      </div>
    );
  }

  if (youtubeVideoId) {
    return (
      <div className="preview-player preview-player-video">
        <iframe
          title={`${label} trailer`}
          src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  }

  return null;
}
