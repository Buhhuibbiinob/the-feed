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
  // Ordered roughly by how often each one is the answer, because the
  // first dozen are what somebody sees before they type anything. Not
  // by this site's own counts: with thirteen members those counts are
  // noise, and an order that reshuffles under people as three more
  // reviews land is worse than one that holds still.
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
    // Everything below here is why the field needed a search box. The
    // first fifteen cover what most people mean; these cover what
    // somebody actually wants to say about a specific record, and a
    // list that stops at "electronic" makes anyone who cares about
    // music feel it was written for somebody else.
    "alternative",
    "soul",
    "funk",
    "disco",
    "house",
    "techno",
    "drum-and-bass",
    "dubstep",
    "garage",
    "ambient",
    "experimental",
    "shoegaze",
    "dream-pop",
    "post-punk",
    "new-wave",
    "synthpop",
    "hyperpop",
    "emo",
    "hardcore",
    "grunge",
    "britpop",
    "psychedelic",
    "prog",
    "blues",
    "gospel",
    "reggae",
    "dancehall",
    "afrobeats",
    "amapiano",
    "highlife",
    "bossa-nova",
    "salsa",
    "reggaeton",
    "bollywood",
    "city-pop",
    "jpop",
    "trap",
    "drill",
    "grime",
    "lo-fi",
    "bedroom-pop",
    "singer-songwriter",
    "americana",
    "bluegrass",
    "opera",
    "musical-theatre",
    "spoken-word",
    "field-recording",
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
    "adventure",
    "mystery",
    "biopic",
    "historical",
    "war",
    "western",
    "musical",
    "family",
    "sitcom",
    "sketch",
    "stand-up",
    "noir",
    "psychological",
    "slasher",
    "found-footage",
    "superhero",
    "heist",
    "courtroom",
    "coming-of-age",
    "road-movie",
    "disaster",
    "sports",
    "spy",
    "martial-arts",
    "experimental",
    "short",
    "miniseries",
    "soap",
    "game-show",
    "nature-doc",
    "true-crime",
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
    "wildlife",
    "macro",
    "still-life",
    "night",
    "astro",
    "travel",
    "wedding",
    "editorial",
    "product",
    "sport",
    "photojournalism",
    "black-and-white",
    "analogue",
    "polaroid",
    "double-exposure",
    "long-exposure",
    "aerial",
    "underwater",
    "self-portrait",
    "conceptual",
    "fine-art",
    "candid",
    "minimal",
  ],
};

/**
 * The handful shown before anybody types.
 *
 * A search box with nothing under it is a blank stare. These are the
 * answers common enough that most people never need to search at all -
 * and short enough that the row is scannable rather than another wall.
 */
export const COMMON_GENRES: Record<MediaType, readonly string[]> = {
  music: ["pop", "hip-hop", "rnb", "rock", "indie", "electronic", "jazz", "metal"],
  movie_tv: ["action", "comedy", "drama", "horror", "thriller", "sci-fi", "documentary", "anime"],
  photography: ["portrait", "street", "landscape", "nature", "fashion", "film", "documentary"],
};

/**
 * What people type when they mean something else.
 *
 * This is the whole difference between a search box that works and one
 * that makes you guess the site's vocabulary. Nobody searches "hip-hop"
 * - they type "rap". Nobody types "rnb". A picker that answers "no
 * matches" to "rap" has told a lie about what it contains.
 */
const ALIASES: Record<string, readonly string[]> = {
  "hip-hop": ["rap", "hiphop"],
  rnb: ["r&b", "rhythm and blues", "randb"],
  kpop: ["k-pop", "korean"],
  jpop: ["j-pop", "japanese"],
  "sci-fi": ["scifi", "science fiction"],
  "drum-and-bass": ["dnb", "drum n bass", "jungle"],
  electronic: ["edm", "dance", "electronica"],
  "stand-up": ["standup", "comedy special"],
  "coming-of-age": ["coming of age", "teen"],
  "black-and-white": ["b&w", "bw", "monochrome", "mono"],
  analogue: ["analog", "35mm", "film camera"],
  "musical-theatre": ["musical theater", "showtunes", "broadway"],
  soundtrack: ["score", "ost"],
  documentary: ["doc", "docs"],
  "true-crime": ["true crime"],
  psychedelic: ["psych"],
  prog: ["progressive"],
  "lo-fi": ["lofi"],
  "still-life": ["still life"],
  "self-portrait": ["selfie", "self portrait"],
  "fine-art": ["fine art", "art"],
  astro: ["astrophotography", "stars", "night sky"],
  photojournalism: ["photojournalist", "news"],
  "found-footage": ["found footage"],
  "martial-arts": ["martial arts", "kung fu"],
  "nature-doc": ["nature documentary", "wildlife doc"],
  "road-movie": ["road movie", "road trip"],
  "field-recording": ["field recording", "sound art"],
  "bossa-nova": ["bossa"],
  "new-wave": ["newwave"],
  "dream-pop": ["dreampop"],
  "post-punk": ["postpunk"],
  "bedroom-pop": ["bedroom"],
  "city-pop": ["citypop"],
  "singer-songwriter": ["singer songwriter", "acoustic"],
};

/** Loosened for matching: lowercase, punctuation spaced, runs collapsed. */
function loosen(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Genres matching what somebody typed.
 *
 * Prefix matches first, then anything containing it. "pop" should offer
 * Pop before Bedroom Pop and Dream Pop, because the exact thing you
 * typed being third in its own result list is the most annoying
 * behaviour a search box has.
 */
export function searchGenres(mediaType: MediaType, query: string, limit = 12): string[] {
  const q = loosen(query);
  const all = GENRES[mediaType] as readonly string[];
  if (!q) return [...COMMON_GENRES[mediaType]];

  const starts: string[] = [];
  const contains: string[] = [];
  for (const slug of all) {
    const terms = [genreLabel(slug), slug, ...(ALIASES[slug] ?? [])].map(loosen);
    if (terms.some((t) => t.startsWith(q))) starts.push(slug);
    else if (terms.some((t) => t.includes(q))) contains.push(slug);
  }
  return [...starts, ...contains].slice(0, limit);
}

// Only where the slug and the label differ. Everything else is title-cased
// from the slug, so adding a genre above usually needs nothing here.
const LABEL_OVERRIDES: Record<string, string> = {
  "hip-hop": "Hip-Hop",
  rnb: "R&B",
  kpop: "K-Pop",
  jpop: "J-Pop",
  "sci-fi": "Sci-Fi",
  rock: "Rock",
  "drum-and-bass": "Drum & Bass",
  "lo-fi": "Lo-Fi",
  prog: "Prog Rock",
  "black-and-white": "Black & White",
  "musical-theatre": "Musical Theatre",
  "stand-up": "Stand-Up",
  "coming-of-age": "Coming-of-Age",
  "post-punk": "Post-Punk",
  "new-wave": "New Wave",
  "dream-pop": "Dream Pop",
  "city-pop": "City Pop",
  "bedroom-pop": "Bedroom Pop",
  "bossa-nova": "Bossa Nova",
  "self-portrait": "Self-Portrait",
  "still-life": "Still Life",
  "fine-art": "Fine Art",
  "found-footage": "Found Footage",
  "martial-arts": "Martial Arts",
  "nature-doc": "Nature Doc",
  "true-crime": "True Crime",
  "road-movie": "Road Movie",
  "field-recording": "Field Recording",
  "singer-songwriter": "Singer-Songwriter",
  "double-exposure": "Double Exposure",
  "long-exposure": "Long Exposure",
  "game-show": "Game Show",
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
