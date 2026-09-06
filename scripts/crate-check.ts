/**
 * What makes a crate a crate.
 *
 * Every rule here is a way it could quietly turn back into a
 * recommender. If the order stops being arbitrary, or the pools stop
 * being mixed, or it starts reading somebody's taste, the page still
 * works - it just stops being the thing it exists to be, and nothing
 * would fail.
 *
 * Run: npx tsx scripts/crate-check.ts
 */
import { readFileSync } from "node:fs";
import { CRATE_SIZE, crateSeed, fillCrate, shuffleWithSeed, type Sleeve } from "../src/lib/crate";
import { NOTHING_KNOWN, alreadyKnown, type SeedPost } from "../src/lib/musicDiscovery";
import type { LastfmTrack } from "../src/lib/lastfm";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

const track = (name: string, artist: string): LastfmTrack => ({
  id: `${artist}-${name}`,
  name,
  artist,
  imageUrl: null,
});

const pool = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => track(`${prefix}${i}`, `${prefix}-artist-${i}`));

// ---- the order is arbitrary and holds still ----------------------------

const items = Array.from({ length: 30 }, (_, i) => i);
check(
  "the same seed gives the same order",
  shuffleWithSeed(items, 42).join() === shuffleWithSeed(items, 42).join(),
  "or the sleeve would change while somebody was looking at it"
);
check(
  "a different seed gives a different order",
  shuffleWithSeed(items, 42).join() !== shuffleWithSeed(items, 43).join()
);
check(
  "shuffling loses nothing",
  shuffleWithSeed(items, 7).slice().sort((a, b) => a - b).join() === items.join()
);
check("shuffling an empty crate is not a crash", shuffleWithSeed([], 5).length === 0);
check("a zero seed still shuffles", shuffleWithSeed(items, 0).join() !== items.join());

// ---- the pools are mixed, not concatenated -----------------------------

const scene = pool("scene", 20);
const decade = pool("decade", 20);
const crate = fillCrate([scene, decade], NOTHING_KNOWN, { seed: 9, size: 20 });
const firstTen = crate.slice(0, 10).map((s) => s.name);
check(
  "a decade record can turn up before a scene record",
  firstTen.some((n) => n.startsWith("decade")) && firstTen.some((n) => n.startsWith("scene")),
  firstTen.join(", ").slice(0, 70)
);
check("the crate is capped", fillCrate([scene, decade], NOTHING_KNOWN, { seed: 3 }).length <= CRATE_SIZE);

// ---- it takes out what you already know --------------------------------

const posts: SeedPost[] = [
  { media_type: "music", title: "scene3", artist: "scene-artist-3", rating: 5 },
  // Same record, typed carelessly. workKey collapses runs of whitespace
  // and drops punctuation but does not delete spaces, so "SCENE 7" is a
  // genuinely different title from "scene7" - this is the case it does
  // cover: capitals, trailing space, and a hyphen in the artist.
  { media_type: "music", title: " Scene7 ", artist: "Scene Artist 7", rating: 2 },
];
const known = alreadyKnown(posts);
const filtered = fillCrate([scene, decade], known, { seed: 4, size: 40 });
check(
  "a record you reviewed is not in the crate",
  !filtered.some((s) => s.name === "scene3")
);
check(
  "matching ignores case, stray spaces and punctuation",
  !filtered.some((s) => s.name === "scene7"),
  "' Scene7 ' by 'Scene Artist 7' is the same record as 'scene7' by 'scene-artist-7'"
);
check(
  "a two-star review is still taken out",
  !filtered.some((s) => s.name === "scene7"),
  "the crate removes what you have SEEN, not what you liked - that is the whole difference"
);
check(
  "everything else is still there",
  filtered.length === scene.length + decade.length - 2,
  `${filtered.length} left`
);

// ---- no record twice ---------------------------------------------------

const dupes = fillCrate([[track("Ceiling", "Wisp"), track("ceiling ", "Wisp")]], NOTHING_KNOWN, {
  seed: 2,
});
check("the same record from two pools appears once", dupes.length === 1);
check(
  "a track with no artist is dropped rather than shown blank",
  fillCrate([[track("Orphan", "")]], NOTHING_KNOWN, { seed: 2 }).length === 0
);

// ---- the seed ----------------------------------------------------------

const noon = new Date("2026-09-06T12:00:30Z");
const sameMinute = new Date("2026-09-06T12:00:55Z");
const laterMinute = new Date("2026-09-06T12:02:00Z");
check(
  "a refresh within the minute keeps your place",
  crateSeed(noon, "abc") === crateSeed(sameMinute, "abc"),
  "otherwise the back button loses the record you were looking at"
);
check("coming back later is a different box", crateSeed(noon, "abc") !== crateSeed(laterMinute, "abc"));
check(
  "two people digging at once get different boxes",
  crateSeed(noon, "abc") !== crateSeed(noon, "xyz")
);
check("a signed-out digger still gets a seed", crateSeed(noon, null) !== 0);

// ---- it does not read anybody's taste ----------------------------------
//
// The one rule that cannot be tested by calling the function, because the
// failure is an import that should not be there. A crate that starts
// seeding from what somebody rated highly is the rails again.
const src = readFileSync("src/lib/crate.ts", "utf8");
for (const forbidden of ["seedArtists", "communitySeeds", "findsForSeeds", "getSimilarArtists"]) {
  check(
    `the crate does not call ${forbidden}`,
    !src.includes(forbidden),
    "ranking by taste is what the rails are for; this is the page that does not"
  );
}
check(
  "the crate uses what you know only to remove it",
  src.includes("known.works.has") && !src.includes("known.artists"),
  "excluding every artist you have reviewed would empty a small crate"
);

const sleeve: Sleeve = crate[0];
check("a sleeve carries no reasoning", !("becauseOf" in sleeve), Object.keys(sleeve).join(","));

console.log(failures === 0 ? "\nThe crate has no opinion." : `\n${failures} failing.`);
process.exit(failures === 0 ? 0 : 1);
