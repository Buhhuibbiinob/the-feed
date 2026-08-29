// Post media types. Adding one here is enough for the post form, the
// feed filter, validation and the profile breakdown to pick it up.
//
// Clubs and the "currently listening/watching" status used to be excluded
// from this list, with their own narrower constraints. They are not any
// more: photography is a category the same as the other two, so there are
// photography clubs and you can say what you are shooting.
export const MEDIA_TYPES = ["music", "movie_tv", "photography"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const MEDIA_LABELS: Record<MediaType, string> = {
  music: "Music/Music Video",
  movie_tv: "Movie/TV",
  photography: "Photography",
};

// Short forms for the feed's filter chips, where the full labels are too
// long to sit in a row on a phone.
export const MEDIA_FILTER_LABELS: Record<MediaType, string> = {
  music: "Music",
  movie_tv: "Movies & TV",
  photography: "Photography",
};

/**
 * What you are doing with each kind of thing.
 *
 * The status line said "Listening to" for music and "Watching" for
 * everything else, which left photography with no verb at all - one more
 * place where it was a category the app knew about but had no words for.
 */
export const MEDIA_VERBS: Record<MediaType, string> = {
  music: "Listening to",
  movie_tv: "Watching",
  photography: "Looking at",
};

/** The same verbs as an invitation, for the status picker's menu. */
export const MEDIA_VERB_PROMPTS: Record<MediaType, string> = {
  music: "Listening to\u2026",
  movie_tv: "Watching\u2026",
  photography: "Looking at\u2026",
};

export function isMediaType(value: unknown): value is MediaType {
  return typeof value === "string" && (MEDIA_TYPES as readonly string[]).includes(value);
}
