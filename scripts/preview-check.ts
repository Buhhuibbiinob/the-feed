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
import { readFileSync } from "node:fs";
import { worthRemembering } from "../src/lib/coverCache";

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

console.log(
  failures === 0
    ? "\nA coverless record keeps its clip: refusals are not answers, and a clip in hand is not re-fetched."
    : `\n${failures} way(s) a record can end up with no cover and nothing to press.`
);
process.exit(failures === 0 ? 0 : 1);
