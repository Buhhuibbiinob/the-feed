import type { MediaType } from "@/lib/media";

// Genre, per category.
//
// A fixed list rather than a free-text field, and that is the entire
// point of the feature. Typed genres arrive as "Hip-Hop", "hip hop",
// "HipHop" and "rap", which cannot be grouped, counted, filtered or
// recommended on - so a free-text genre is a genre you cannot use for
// anything, which is the same as not having one.
//
// Everything downstream that wants to know what somebody is into is
// currently stuck with three values: music, movie_tv, photography.
// "You like movies" is not a taste. This is the smallest field that
// turns it into one.
//
// Slugs are stored, labels are displayed. Renaming a label later then
// costs nothing, while renaming a stored value costs a migration.

export const GENRES: Record<MediaType, readonly string[]> = {
  music: [
    "pop",
    "hip-hop",
    "rnb",
    "rock",
    "indie",
    "electronic",
    "country",
    "jazz",
    "classical",
    "metal",
    "punk",
    "folk",
    "latin",
    "kpop",
    "soundtrack",
  ],
  movie_tv: [
    "action",
    "comedy",
    "drama",
    "horror",
    "thriller",
    "sci-fi",
    "fantasy",
    "romance",
    "documentary",
    "animation",
    "anime",
    "crime",
    "reality",
  ],
  photography: [
    "portrait",
    "street",
    "landscape",
    "fashion",
    "nature",
    "architecture",
    "film",
    "documentary",
    "abstract",
  ],
};

// Only where the slug and the label differ. Everything else is title-cased
// from the slug, so adding a genre above usually needs nothing here.
const LABEL_OVERRIDES: Record<string, string> = {
  "hip-hop": "Hip-Hop",
  rnb: "R&B",
  kpop: "K-Pop",
  "sci-fi": "Sci-Fi",
  rock: "Rock",
};

export function genreLabel(slug: string): string {
  return (
    LABEL_OVERRIDES[slug] ??
    slug
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

/**
 * Whether this genre belongs to this category.
 *
 * Checked as a pair, always. "Documentary" is a genre of both film and
 * photography but not of music, and a post claiming a genre its category
 * doesn't have is a row that no filter will ever match - invisible, and
 * so never reported.
 */
export function isGenreFor(mediaType: MediaType, value: unknown): value is string {
  return typeof value === "string" && (GENRES[mediaType] as readonly string[]).includes(value);
}

/** Which category a genre belongs to, for building a link out of a badge. */
export function mediaTypeForGenre(slug: string): MediaType | null {
  for (const [type, list] of Object.entries(GENRES)) {
    if ((list as readonly string[]).includes(slug)) return type as MediaType;
  }
  return null;
}
