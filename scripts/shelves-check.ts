/**
 * The dividers, and what is behind them.
 *
 * The value in the URL goes straight into a Last.fm tag query, so the
 * guard on it is the one thing here that is not cosmetic. The rest is
 * about the page keeping its promise: a shelf is what the tag gave,
 * trimmed - not re-sorted into another ranking.
 *
 * Run: npx tsx scripts/shelves-check.ts
 */
import { readFileSync } from "node:fs";
import {
  FIRST_YEAR,
  SHELF_SIZE,
  axes,
  fillShelf,
  isAxis,
  isShelfValue,
  shelfTitle,
  yearValues,
} from "../src/lib/shelves";
import { NOTHING_KNOWN, alreadyKnown, type SeedPost } from "../src/lib/musicDiscovery";
import type { LastfmTrack } from "../src/lib/lastfm";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

const now = new Date("2026-09-06T12:00:00Z");
const track = (name: string, artist: string, listeners?: number): LastfmTrack => ({
  id: `${artist}-${name}`,
  name,
  artist,
  imageUrl: null,
  listeners,
});

// ---- the wall ----------------------------------------------------------

const wall = axes(now);
check("there are four ways in", wall.length === 4, wall.map((a) => a.id).join(", "));
check("every axis has dividers behind it", wall.every((a) => a.values.length > 0));
check(
  "every axis says what it gets you",
  wall.every((a) => a.prompt.length > 0 && a.label.length > 0)
);
check(
  "scenes are not only microgenres",
  ["soul", "disco", "house"].every((s) => wall.find((a) => a.id === "scene")!.values.includes(s)),
  "a wall that only holds microgenres is a wall for people who already know"
);

const years = yearValues(now);
check("the newest year comes first", years[0] === "2026", years.slice(0, 3).join(", "));
check("the wall reaches back to the start", years[years.length - 1] === String(FIRST_YEAR));
check("no year is missing", years.length === 2026 - FIRST_YEAR + 1, `${years.length} dividers`);

// ---- the guard on the URL ----------------------------------------------

check("a real axis is accepted", isAxis("scene") && isAxis("year"));
check("anything else is not", !isAxis("albums") && !isAxis("") && !isAxis(null));

check("a year on the wall is allowed", isShelfValue("year", "1994", now));
check("this year is allowed", isShelfValue("year", "2026", now));
check("next year is not", !isShelfValue("year", "2027", now), "there is nothing behind that divider yet");
check("a year before the wall starts is not", !isShelfValue("year", "1959", now));
check("a year that is not a year is not", !isShelfValue("year", "94", now) && !isShelfValue("year", "19x4", now));
check("a scene on the wall is allowed", isShelfValue("scene", "shoegaze", now));
check(
  "a tag somebody typed themselves is not",
  !isShelfValue("scene", "anything at all", now),
  "the value goes into a tag query, so it is checked rather than trusted"
);
check("an axis cannot borrow another's values", !isShelfValue("place", "shoegaze", now));
check("a non-string is not a value", !isShelfValue("scene", 7, now));

// ---- titles ------------------------------------------------------------

check("a year is its own title", shelfTitle("year", "1994") === "1994");
check("a scene is capitalised", shelfTitle("scene", "dream pop") === "Dream Pop");
check("a place is capitalised", shelfTitle("place", "new york") === "New York");
check("the 2000s is not 'The 00s'", shelfTitle("decade", "00s") === "The 2000s", shelfTitle("decade", "00s"));
check("a decade keeps its decade", shelfTitle("decade", "90s") === "The 90s");

// ---- the shelf ---------------------------------------------------------

const chart = Array.from({ length: 40 }, (_, i) => track(`t${i}`, `a${i}`));
const shelf = fillShelf(chart, NOTHING_KNOWN);
check("a shelf is capped", shelf.length === SHELF_SIZE, `${shelf.length} records`);
check(
  "the chart's front is trimmed",
  shelf[0].name === "t5",
  "the top of a tag is that scene's greatest hits, which is what somebody browsing it has heard"
);
check(
  "the order is the chart's, not a new one",
  shelf.slice(0, 4).map((s) => s.name).join(",") === "t5,t6,t7,t8",
  "re-sorting would be this page having an opinion"
);

const known = alreadyKnown([
  { media_type: "music", title: "t7", artist: "a7", rating: 3 },
] as SeedPost[]);
check(
  "a record you reviewed is off the shelf",
  !fillShelf(chart, known).some((s) => s.name === "t7")
);

const hits = [
  ...Array.from({ length: 5 }, (_, i) => track(`front${i}`, `f${i}`)),
  track("Everybody Knows This", "Famous", 3_000_000),
  track("Nobody Knows This", "Obscure", 900),
];
check(
  "a hit is not on the shelf",
  !fillShelf(hits, NOTHING_KNOWN).some((s) => s.name === "Everybody Knows This")
);
check(
  "a short chart falls back rather than emptying",
  fillShelf([track("Only One", "Someone")], NOTHING_KNOWN).length === 1,
  "trimming five off a four-track tag would leave a shelf with nothing on it"
);
check(
  "the same record twice appears once",
  fillShelf([track("Ceiling", "Wisp"), track("ceiling ", "Wisp")], NOTHING_KNOWN).length === 1
);
check(
  "a track with no artist is dropped",
  fillShelf([track("Orphan", "")], NOTHING_KNOWN).length === 0
);

// ---- it stays a browser, not a recommender -----------------------------

const src = readFileSync("src/lib/shelves.ts", "utf8");
for (const forbidden of ["seedArtists", "communitySeeds", "getSimilarArtists", "findsForSeeds"]) {
  check(`shelves do not call ${forbidden}`, !src.includes(forbidden));
}
check(
  "nothing is re-sorted",
  !/\.sort\(/.test(src),
  "the shelf is the tag chart trimmed; sorting it would be a ranking"
);

console.log(failures === 0 ? "\nYou pick the shelf; it does not pick for you." : `\n${failures} failing.`);
process.exit(failures === 0 ? 0 : 1);
