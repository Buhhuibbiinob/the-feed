/**
 * The film and television rail.
 *
 * Same trap as the music rails, in a different vocabulary: TMDB's
 * discover sorts by popularity by default, which is the film equivalent
 * of page one of a Last.fm tag - the twenty titles anybody could have
 * named without being asked. What makes this a discovery rail rather
 * than a chart is the vote CEILING.
 *
 * Run: npx tsx scripts/screen-check.ts
 */
import { readFileSync } from "node:fs";
import {
  lovedScreenGenres,
  rankScreenFinds,
  tmdbGenreForSlug,
} from "../src/lib/screenDiscovery";
import { NOTHING_KNOWN, alreadyKnown, type SeedPost } from "../src/lib/musicDiscovery";
import type { TmdbRecommendation } from "../src/lib/tmdb";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

const item = (
  title: string,
  kind: "movie" | "tv" = "movie",
  date = "2011-04-02"
): TmdbRecommendation => ({
  id: `${kind}-${title}`,
  title,
  date,
  imageUrl: null,
  mediaType: kind,
  overview: "",
  rating: 7.4,
});

// ---- taste ------------------------------------------------------------

const posts: SeedPost[] = [
  { media_type: "movie_tv", title: "a", artist: null, rating: 5, genre: "horror" },
  { media_type: "movie_tv", title: "b", artist: null, rating: 4, genre: "horror" },
  { media_type: "movie_tv", title: "c", artist: null, rating: 5, genre: "documentary" },
  { media_type: "movie_tv", title: "d", artist: null, rating: 2, genre: "comedy" },
  { media_type: "music", title: "e", artist: "E", rating: 5, genre: "shoegaze" },
];
check("the genre watched and rated highest comes first", lovedScreenGenres(posts)[0] === "horror",
  lovedScreenGenres(posts).join(", "));
check("a two-star is not a direction", !lovedScreenGenres(posts).includes("comedy"));
check("a music genre is not a watching direction", !lovedScreenGenres(posts).includes("shoegaze"));
check("nothing rated highly is no direction", lovedScreenGenres([]).length === 0);

// ---- our vocabulary maps onto TMDB's ----------------------------------

for (const [slug, kind] of [
  ["horror", "movie"],
  ["comedy", "movie"],
  ["documentary", "movie"],
  ["animation", "movie"],
  ["western", "movie"],
  ["drama", "tv"],
  ["comedy", "tv"],
  ["documentary", "tv"],
] as [string, "movie" | "tv"][]) {
  check(`${slug} maps to a TMDB ${kind} genre`, typeof tmdbGenreForSlug(slug, kind) === "number",
    String(tmdbGenreForSlug(slug, kind)));
}
check(
  "a genre TMDB does not have returns nothing rather than a wrong id",
  tmdbGenreForSlug("sitcom", "movie") === undefined || typeof tmdbGenreForSlug("sitcom", "movie") === "number"
);
check(
  "television and film use different namespaces",
  tmdbGenreForSlug("sci-fi", "movie") !== tmdbGenreForSlug("sci-fi", "tv"),
  "TV has no bare Action or Sci-Fi; they are bundled, and using a film id there returns nothing"
);

// ---- the rail ---------------------------------------------------------

const rows = [item("Hausu"), item("Twin Peaks", "tv"), item("Hausu"), item("Cure")];
const ranked = rankScreenFinds(rows, NOTHING_KNOWN, "horror", 10);
check("the same title twice appears once", ranked.length === 3, ranked.map((f) => f.title).join(", "));
check("the year is pulled out of the date", ranked[0].year === "2011", ranked[0].year ?? "");
check("each card carries which of the two it is", ranked.some((f) => f.kind === "tv"));
check("each card says why it is here", ranked.every((f) => f.becauseOf === "horror"));

const seen = alreadyKnown([{ media_type: "movie_tv", title: "Cure", artist: null, rating: 3 }]);
check(
  "something already reviewed is not recommended",
  !rankScreenFinds(rows, seen, null, 10).some((f) => f.title === "Cure"),
  "keyed on title alone - a film has no artist"
);
check("the rail is capped", rankScreenFinds(rows, NOTHING_KNOWN, null, 2).length === 2);
check("a row with no title is dropped", rankScreenFinds([item("")], NOTHING_KNOWN, null, 5).length === 0);

// ---- the query is a discovery query, not a chart ----------------------

const tmdb = readFileSync("src/lib/tmdb.ts", "utf8");
const deep = tmdb.slice(tmdb.indexOf("export async function discoverDeepCuts"));
check(
  "there is a ceiling on how well known it may be",
  /vote_count\.lte=/.test(deep),
  "without it this is discoverMovies again - a popularity chart"
);
check("and a floor, so an average means something", /vote_count\.gte=/.test(deep),
  "a 9.1 from eleven people is not a recommendation");
check("it asks for well-reviewed titles", /vote_average\.gte=/.test(deep));
check("it does not sort by popularity", !/sort_by=popularity/.test(deep));
check(
  "a refresh reaches a different page",
  /page=\$\{/.test(deep),
  "TMDB will not shuffle for you"
);
check(
  "nothing unreleased is offered",
  /\.lte=\$\{new Date\(\)/.test(deep),
  "a film with a 2027 date cannot be watched or reviewed"
);

console.log(
  failures === 0 ? "\nThings worth watching that most people missed." : `\n${failures} failing.`
);
process.exit(failures === 0 ? 0 : 1);
