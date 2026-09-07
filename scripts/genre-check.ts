/**
 * The genre taxonomy holds together.
 *
 * Run: npx tsx scripts/genre-check.ts
 */
import { COMMON_GENRES, FAMILIES, GENRES, familyForGenre, genreLabel, isGenreFor, searchGenres } from "../src/lib/genres";
import type { MediaType } from "../src/lib/media";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

const TYPES: MediaType[] = ["music", "movie_tv", "photography"];

/**
 * Every slug the flat list had before it became a taxonomy.
 *
 * Frozen here on purpose. These are on real posts, and a genre that
 * disappears does not delete its rows - it hides them: isGenreFor goes
 * false, the badge stops rendering, and no filter ever matches that row
 * again. Nothing about that is visible from the outside, which is
 * exactly why it is pinned.
 */
const WAS_ALREADY_LIVE: Record<MediaType, string[]> = {
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

for (const type of TYPES) {
  const list = GENRES[type] as string[];

  const dupes = [...new Set(list.filter((g, i) => list.indexOf(g) !== i))];
  check(`${type}: no genre appears twice`, dupes.length === 0, dupes.join(", "));

  const homeless = list.filter((g) => !familyForGenre(type, g));
  check(`${type}: every genre is in a family`, homeless.length === 0, homeless.slice(0, 6).join(", "));

  const lost = WAS_ALREADY_LIVE[type].filter((g) => !isGenreFor(type, g));
  check(
    `${type}: nothing that was already live has gone`,
    lost.length === 0,
    lost.length ? `${lost.join(", ")} - posts using these would go invisible` : ""
  );

  const strays = (COMMON_GENRES[type] as string[]).filter((g) => !isGenreFor(type, g));
  check(`${type}: the common shortlist is all real genres`, strays.length === 0, strays.join(", "));

  const blank = list.filter((g) => !genreLabel(g).trim());
  check(`${type}: every genre has a label`, blank.length === 0, blank.join(", "));

  console.log(`      ${list.length} genres across ${FAMILIES[type].length} families`);
}

// A slug in two categories is fine and deliberate - "documentary" is a
// genre of both film and photography - but it must still be checked as a
// pair, or a photography post could claim a film-only genre.
check("a film genre is not a photography genre", !isGenreFor("photography", "slasher"));
check("a music genre is not a film genre", !isGenreFor("movie_tv", "shoegaze"));
check("documentary is genuinely both", isGenreFor("movie_tv", "documentary") && isGenreFor("photography", "documentary"));

// The search is what makes eight hundred usable rather than a wall.
check("an empty query gives the shortlist", searchGenres("music", "").length > 0);
check("a prefix finds the microgenre", searchGenres("music", "shoeg").includes("shoegaze"));
check("a middle-of-the-word match still finds it", searchGenres("music", "gaze").includes("shoegaze"));
check(
  "a search that matches nothing returns nothing rather than everything",
  searchGenres("music", "zzzzqqq").length === 0
);

console.log(failures === 0 ? "\nEight hundred genres, and every one of them findable." : `\n${failures} failing.`);
if (failures > 0) process.exit(1);
