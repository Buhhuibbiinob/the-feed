export const ARTIST_PLATFORMS = ["spotify", "soundcloud", "apple_music", "youtube"] as const;
export type ArtistPlatform = (typeof ARTIST_PLATFORMS)[number];

export const ARTIST_PLATFORM_LABELS: Record<ArtistPlatform, string> = {
  spotify: "Spotify",
  soundcloud: "SoundCloud",
  apple_music: "Apple Music",
  youtube: "YouTube",
};
