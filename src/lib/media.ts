// Post media types. Adding one here is enough for the post form, the
// feed filter, validation and the profile breakdown to pick it up.
//
// Clubs and the "currently listening/watching" status deliberately do NOT
// use this list - both have narrower database constraints and their own
// hardcoded options, since a photography club or a "currently viewing"
// status wasn't asked for.
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
