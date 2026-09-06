/**
 * The genre field.
 *
 * The rule that matters most is not about search: it is that a slug can
 * never leave the list. Genres are stored on posts, and isGenreFor()
 * validates against this list on every edit - so deleting or renaming a
 * slug silently strips the genre off every review that had it, the next
 * time anybody touches one. Nothing would fail.
 *
 * Run: npx tsx scripts/genre-picker-check.ts
 */
import { COMMON_GENRES, GENRES, genreLabel, isGenreFor, searchGenres } from "../src/lib/genres";
import type { MediaType } from "../src/lib/media";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

// ---- nothing may leave ------------------------------------------------
//
// Every slug that has ever been offered. Add to this list; never remove
// from it. If a genre is retired it still has to stay valid, or the
// reviews carrying it lose it on their next edit.
const EVER_OFFERED: Record<MediaType, string[]> = {
  music: ["pop", "hip-hop", "rnb", "rock", "indie", "electronic", "country", "jazz",
          "classical", "metal", "punk", "folk", "latin", "kpop", "soundtrack"],
  movie_tv: ["action", "comedy", "drama", "horror", "thriller", "sci-fi", "fantasy",
             "romance", "documentary", "animation", "anime", "crime", "reality"],
  photography: ["portrait", "street", "landscape", "fashion", "nature", "architecture",
                "film", "documentary", "abstract"],
};
for (const [type, slugs] of Object.entries(EVER_OFFERED) as [MediaType, string[]][]) {
  const missing = slugs.filter((slug) => !isGenreFor(type, slug));
  check(
    `every ${type} genre ever offered is still valid`,
    missing.length === 0,
    missing.length ? `dropped: ${missing.join(", ")} - reviews carrying these lose them on their next edit` : `${slugs.length} kept`
  );
}

// ---- the list is worth searching --------------------------------------

check(
  "there is more here than a wall of fifteen",
  GENRES.music.length >= 40,
  `${GENRES.music.length} music genres - a list that stops at "electronic" tells anybody who cares that the field was written for somebody else`
);
check("no genre is listed twice in one category",
  Object.values(GENRES).every((list) => new Set(list).size === list.length));
// A label still carrying a slug hyphen between two lowercase letters
// ("dream-pop") is a slug that nobody wrote a name for. "Coming-of-Age"
// is deliberately hyphenated English, so the rule is about the CASE
// either side, not the hyphen.
const slugLike = Object.values(GENRES)
  .flat()
  .map(genreLabel)
  .filter((label) => /[a-z]-[a-z]/.test(label) && label !== "Coming-of-Age");
check("every label reads as a name, not a slug", slugLike.length === 0, slugLike.join(", "));

// ---- the row you see before typing ------------------------------------

for (const [type, common] of Object.entries(COMMON_GENRES) as [MediaType, readonly string[]][]) {
  check(
    `${type}'s opening row is scannable`,
    common.length >= 5 && common.length <= 9,
    `${common.length} chips`
  );
  const stray = common.filter((slug) => !isGenreFor(type, slug));
  check(`${type}'s opening row is all real genres`, stray.length === 0, stray.join(", "));
}
check("an empty query shows the common row", searchGenres("music", "").length === COMMON_GENRES.music.length);
check("whitespace counts as empty", searchGenres("music", "   ").length === COMMON_GENRES.music.length);

// ---- what people actually type ----------------------------------------
//
// Every one of these is a word somebody would really use. A picker that
// says "no matches" to any of them has told a lie about what it holds.
const TYPED: [MediaType, string, string][] = [
  ["music", "rap", "hip-hop"],
  ["music", "hiphop", "hip-hop"],
  ["music", "r&b", "rnb"],
  ["music", "edm", "electronic"],
  ["music", "dnb", "drum-and-bass"],
  ["music", "lofi", "lo-fi"],
  ["music", "k-pop", "kpop"],
  ["music", "score", "soundtrack"],
  ["music", "acoustic", "singer-songwriter"],
  ["movie_tv", "scifi", "sci-fi"],
  ["movie_tv", "science fiction", "sci-fi"],
  ["movie_tv", "true crime", "true-crime"],
  ["movie_tv", "standup", "stand-up"],
  ["photography", "b&w", "black-and-white"],
  ["photography", "monochrome", "black-and-white"],
  ["photography", "35mm", "analogue"],
  ["photography", "analog", "analogue"],
];
for (const [type, typed, expected] of TYPED) {
  check(
    `"${typed}" finds ${genreLabel(expected)}`,
    searchGenres(type, typed).includes(expected),
    searchGenres(type, typed).map(genreLabel).join(", ") || "nothing"
  );
}

// ---- the exact thing you typed comes first ----------------------------

check(
  "typing a genre's own name puts it first",
  searchGenres("music", "pop")[0] === "pop",
  `got ${searchGenres("music", "pop").map(genreLabel).join(", ")} - the exact match being third in its own result list is the most annoying thing a search box does`
);
check("typing 'punk' puts Punk before Post-Punk", searchGenres("music", "punk")[0] === "punk");
check("a query matching nothing returns nothing", searchGenres("music", "zzzzz").length === 0);
check("results are capped", searchGenres("music", "o", 6).length <= 6);

// ---- a genre still belongs to its category ----------------------------

check("documentary is a film genre", isGenreFor("movie_tv", "documentary"));
check("documentary is a photography genre too", isGenreFor("photography", "documentary"));
check("documentary is not a music genre", !isGenreFor("music", "documentary"));
check("shoegaze is not a film genre", !isGenreFor("movie_tv", "shoegaze"));

console.log(failures === 0 ? "\nYou can find what you meant, and nothing lost its genre." : `\n${failures} failing.`);
process.exit(failures === 0 ? 0 : 1);
