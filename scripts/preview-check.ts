/**
 * A record you cannot see should at least be a record you can play.
 *
 * The covers and the clips arrive from the same lookup, and every time
 * this area has broken it has broken the same way: something treated
 * "Apple would not answer just now" as "this record has nothing", wrote
 * that down, and left a square with no picture AND no play button. That
 * is a dead record on the shelf, and it is the worst of the three
 * possible outcomes - worse than a blank sleeve you can hear, and worse
 * than no record at all.
 *
 * So the two rules that keep a clip attached to a coverless record are
 * checked rather than trusted:
 *
 *  1. A refusal is never remembered as an answer, anywhere.
 *  2. A component that already has a clip in hand uses it instead of
 *     asking again - because the second ask is the one that gets
 *     refused, and then the record it had a clip for has none.
 *
 * Run: npx tsx scripts/preview-check.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { worthRemembering } from "../src/lib/coverCache";

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else if (path.endsWith(".ts") || path.endsWith(".tsx")) out.push(path);
  }
  return out;
}
const SOURCES = walk("src");

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

const found = { artworkUrl: "a", previewUrl: "p", trackUrl: null, year: null };
const artOnly = { artworkUrl: "a", previewUrl: null, trackUrl: null, year: null };
const clipOnly = { artworkUrl: null, previewUrl: "p", trackUrl: null, year: null };
const nothing = { artworkUrl: null, previewUrl: null, trackUrl: null, year: null };
const refused = { ...nothing, throttled: true };

check("a real answer is remembered", worthRemembering(found, false));
check("a cover with no clip is still an answer", worthRemembering(artOnly, false));
// The case this whole check exists for. A record Apple has a preview
// for but no artwork is a blank sleeve you can play, which is a record.
check("a clip with no cover is still an answer", worthRemembering(clipOnly, false));
check("a refusal is never remembered", !worthRemembering(refused, true));
check("a refusal is never remembered, shallow either", !worthRemembering(refused, false));
// A plain search is a relevance search: it misses tracks the artist's
// own catalogue has. Writing that miss down as fact is how a playable
// record becomes permanently unplayable for everybody.
check("a shallow miss is NOT remembered as 'Apple has nothing'", !worthRemembering(nothing, false));
check("a deep miss IS remembered", worthRemembering(nothing, true));

// Every caller of the single-sleeve route has to tell a refusal from an
// answer. The route says 503 for a throttle; a caller that goes straight
// to res.json() reads that as a record with no clip and records it.
const CALLERS = [
  "src/components/Crate.tsx",
  "src/components/RecordRack.tsx",
  "src/components/YourShelf.tsx",
];
for (const file of CALLERS) {
  const src = readFileSync(file, "utf8");
  if (!src.includes("/api/crate/sleeve?")) {
    check(`${file} still asks for sleeves`, false, "the check is out of date");
    continue;
  }
  const handles = /res\.ok|res\.status === 503|status === 503/.test(src);
  check(`${file} tells a refusal from an answer`, handles);
}

// The rack looks up a screenful at a time and gets the clips with the
// covers. Reaching for the network again for a clip already in memory
// is a request that can be refused, and a refused one takes the play
// button off a record that had one.
const rack = readFileSync("src/components/RecordRack.tsx", "utf8");
check(
  "the rack plays the clip it already batched before the one it fetched",
  /heldInfo\?\.previewUrl\s*\?\?\s*pulled/.test(rack)
);
check(
  "the rack does not fetch a clip it already has",
  /alreadyHave[\s\S]{0,120}?heldInfo\?\.previewUrl/.test(rack)
);

// The batch route asks a second time, properly, for the records that
// came back with nothing at all. That pass is where a coverless record
// gets its clip.
const batch = readFileSync("src/app/api/crate/sleeves/route.ts", "utf8");
check("the batch goes back for the records that came back empty", /nothingFound/.test(batch));
check("...and that second pass uses the catalogue fallback", /pool\(nothingFound[\s\S]{0,40}?,\s*true\)/.test(batch));

// ---- a record plays its clip, and nothing else ----
//
// The shelves, the crate and the racks used to fall back to a YouTube
// embed for a record no catalogue had a preview for. That was the wrong
// answer to the right problem: a wall of records is not a place to
// watch anything, and a sleeve that turns into a video player is not a
// sleeve.
//
// The right answer was the second catalogue. Between Apple and Deezer
// far more records have a real 30-second clip than either had alone,
// and where there is genuinely none the record still stands there with
// its name printed on it - readable, and reviewable, which is the thing
// this site is actually for.
//
// So no music surface may embed a video. Film keeps its trailer: a
// trailer IS the thing, in the way a music video is not.
const MUSIC_SURFACES = [
  "src/components/ShelfRecords.tsx",
  "src/components/RecordRack.tsx",
  "src/components/YourShelf.tsx",
];
for (const file of MUSIC_SURFACES) {
  const src = readFileSync(file, "utf8");
  check(`${file} plays a clip, not a video`, !/youtube\.com\/embed/.test(src));
}
// The crate holds both, so it is checked more precisely: the only embed
// in it has to be the film branch.
{
  const crate = readFileSync("src/components/Crate.tsx", "utf8");
  const embeds = crate.split("\n").filter((l) => l.includes("youtube.com/embed"));
  check("the crate embeds only a film trailer", embeds.length === 1, embeds.join(" | "));
  check(
    "and only on the film branch",
    /current\.kind === "film" && playing && current\.videoId/.test(crate)
  );
}
// The route and the client that spent YouTube quota to play a record
// are gone with the feature, rather than left behind to be rediscovered
// and rewired by somebody later.
check(
  "nothing spends YouTube quota to play a record any more",
  !SOURCES.some((f) => readFileSync(f, "utf8").includes("/api/music/play"))
);

console.log(
  failures === 0
    ? "\nA coverless record keeps its clip, and a record is never a video player."
    : `\n${failures} way(s) a record can end up with no cover and nothing to press.`
);
process.exit(failures === 0 ? 0 : 1);
