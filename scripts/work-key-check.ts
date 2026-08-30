/**
 * Two reviews of the same thing agree; two reviews of different things don't.
 *
 * This key decides which reviews get grouped onto one page under one
 * title, in public. A missed merge is a page that says "1 review" when it
 * could have said 2. A FALSE merge puts somebody's review of one film
 * under the name of another, where they cannot explain it and did not do
 * anything wrong - so the two directions are not equally bad, and the
 * cases below are weighted accordingly.
 *
 * Run: npx tsx scripts/work-key-check.ts
 */
import { normalizeName, workKey, averageRating } from "../src/lib/works";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}
const same = (a: string, b: string) => a === b && a !== "";

// --- The merges that must happen -------------------------------------
check("case and stray whitespace",
  same(workKey("movie_tv", "Dune"), workKey("movie_tv", "  dune ")));
check("accents", same(workKey("music", "Crepusculo", "X"), workKey("music", "Crépusculo", "X")));
check("punctuation", same(workKey("movie_tv", "Wall-E"), workKey("movie_tv", "Wall E")));
check("a trailing year in brackets",
  same(workKey("movie_tv", "Dune"), workKey("movie_tv", "Dune (2021)")));
check("a remaster tag",
  same(workKey("music", "Rumours (Remastered)", "Fleetwood Mac"), workKey("music", "Rumours", "Fleetwood Mac")));
check("a featured artist in brackets",
  same(workKey("music", "Alright (feat. Someone)", "Kendrick"), workKey("music", "Alright", "Kendrick")));
check("the artist's own case and spacing",
  same(workKey("music", "Rumours", "fleetwood mac"), workKey("music", "Rumours", " Fleetwood Mac ")));

// --- The merges that must NOT happen ----------------------------------
check("a film and a song of the same name stay apart",
  workKey("movie_tv", "Blue") !== workKey("music", "Blue", null));
check("two songs called Alright by different artists stay apart",
  workKey("music", "Alright", "Kendrick") !== workKey("music", "Alright", "Supergrass"));
check("a sequel is not its original",
  workKey("movie_tv", "Dune") !== workKey("movie_tv", "Dune: Part Two"));
check("a number in the title is part of it",
  workKey("movie_tv", "Blade Runner") !== workKey("movie_tv", "Blade Runner 2049"));
check("leading The is kept, because guessing wrong is the expensive way",
  workKey("movie_tv", "The Office") !== workKey("movie_tv", "Office"));
check("brackets in the middle are part of the name",
  workKey("music", "Everything (I Do) For You", "X") !== workKey("music", "Everything For You", "X"));

// --- Degenerate input --------------------------------------------------
check("an empty title has no key", workKey("movie_tv", "") === "");
check("a title of only punctuation has no key", workKey("movie_tv", "!!! ???") === "");
check("music with no artist still gets a key", workKey("music", "Alright", null) !== "");
check("music with no artist is not the same as music with one",
  workKey("music", "Alright", null) !== workKey("music", "Alright", "Kendrick"));
check("normalizeName never returns leading or trailing space",
  normalizeName("  Dune (2021)  ") === "dune");

// --- The average shown next to it -------------------------------------
{
  const none = averageRating([null, null]);
  check("no ratings is not a zero-star average", none.count === 0 && none.average === 0);
  const some = averageRating([5, 4, null, 3]);
  check("unrated reviews don't drag the average down", some.count === 3 && some.average === 4);
  const rounded = averageRating([5, 4, 4]);
  check("one decimal place, not fifteen", rounded.average === 4.3, String(rounded.average));
}

if (failures > 0) {
  console.error(`\n${failures} check${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
console.log("\nWorks merge when they should and stay apart when they should.");
