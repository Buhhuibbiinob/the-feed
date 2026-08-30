/**
 * Genres are only ever valid as a pair with their category.
 *
 * "Documentary" is a genre of film and of photography but not of music.
 * A post that claims a genre its category doesn't have is a row no filter
 * will ever match: invisible on the feed, uncounted everywhere, and
 * silent about it. So the pairing is checked here rather than trusted.
 *
 * Run: npx tsx scripts/genre-check.ts
 */
import { GENRES, genreLabel, isGenreFor, mediaTypeForGenre } from "../src/lib/genres";
import { MEDIA_TYPES } from "../src/lib/media";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

check("every category has genres", MEDIA_TYPES.every((t) => GENRES[t].length > 0));

check("a film genre is valid for film", isGenreFor("movie_tv", "horror"));
check("a film genre is not valid for music", !isGenreFor("music", "horror"));
check("a music genre is not valid for film", !isGenreFor("movie_tv", "kpop"));
check("documentary belongs to both film and photography",
  isGenreFor("movie_tv", "documentary") && isGenreFor("photography", "documentary"));
check("documentary is not a music genre", !isGenreFor("music", "documentary"));

// Anything a form can post that isn't a genre.
for (const junk of [null, undefined, "", " horror", "HORROR", 5, {}, "'; drop table posts;--"]) {
  check(`rejects ${JSON.stringify(junk)}`, !isGenreFor("movie_tv", junk));
}

// Slugs go in URLs and into a database column; labels go on screen.
const allSlugs = MEDIA_TYPES.flatMap((t) => [...GENRES[t]]);
check("slugs are url-safe", allSlugs.every((s) => /^[a-z0-9-]+$/.test(s)), allSlugs.find((s) => !/^[a-z0-9-]+$/.test(s)) ?? "");
check("every slug has a non-empty label", allSlugs.every((s) => genreLabel(s).length > 0));
check("labels are capitalised", allSlugs.every((s) => /^[A-Z]/.test(genreLabel(s))),
  allSlugs.find((s) => !/^[A-Z]/.test(genreLabel(s))) ?? "");
check("R&B and K-Pop keep their punctuation",
  genreLabel("rnb") === "R&B" && genreLabel("kpop") === "K-Pop" && genreLabel("hip-hop") === "Hip-Hop");

check("no duplicates inside a category",
  MEDIA_TYPES.every((t) => new Set(GENRES[t]).size === GENRES[t].length));

// Shared slugs are fine; the lookup just has to be deterministic about them.
check("mediaTypeForGenre finds a unique genre", mediaTypeForGenre("kpop") === "music");
check("mediaTypeForGenre returns null for a non-genre", mediaTypeForGenre("polka") === null);

if (failures > 0) {
  console.error(`\n${failures} check${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
console.log("\nGenres are valid only where they belong.");
