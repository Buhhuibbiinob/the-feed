export const MEDIA_TYPES = ["music", "movie_tv"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const MEDIA_LABELS: Record<MediaType, string> = {
  music: "Music/Music Video",
  movie_tv: "Movie/TV",
};
