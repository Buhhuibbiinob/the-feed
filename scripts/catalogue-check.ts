/**
 * Two catalogues, and the order that keeps the shelves full.
 *
 * Apple is free, keyless, knows release years, and allows roughly twenty
 * calls a minute across everything this site does. That last number is
 * the single fact behind most of the trouble this area has had: blank
 * sleeves, shelves that emptied themselves, a search box told the
 * catalogue is busy while a page of covers loaded behind it.
 *
 * Deezer is free, keyless, and allows about thirty times as many
 * requests. It does not reliably give a year, which is why it is second
 * rather than first - the shelves use the year to decide whether a
 * record belongs on a decade.
 *
 * The behaviour that matters is what happens when Apple refuses.
 * lookupItunesTrack backs off and retries twice, which is right for one
 * record and ruinous for a batch: the throttle does not clear in the two
 * seconds a batch has, so every record costs three refused requests and
 * comes back empty anyway. So the first 403 has to send the whole batch
 * to Deezer instead, and that is what is checked here.
 *
 * Run: npx tsx scripts/catalogue-check.ts
 */
import { readFileSync } from "node:fs";
import { appleIsBusy, noteAppleThrottled, resetAppleBusy } from "../src/lib/catalogue";
import { findMatch, type DeezerTrack } from "../src/lib/deezer";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

resetAppleBusy();
check("nothing is assumed about Apple to begin with", !appleIsBusy());

noteAppleThrottled();
check("one refusal marks it busy", appleIsBusy());
// The whole point: the NEXT record does not walk into the same wall.
check("and it stays busy for the rest of the batch", appleIsBusy(Date.now() + 5_000));
// But not forever - Apple is the one with the years, so it has to be
// tried again once the minute has moved on.
check("but not forever", !appleIsBusy(Date.now() + 120_000));
resetAppleBusy();
check("and it can be cleared", !appleIsBusy());

// Everything that looks up a record goes through the pair. A call site
// that reaches for Apple directly gets Apple's rate limit and none of
// Deezer's headroom, which is exactly the failure this exists to end.
const DIRECT = [
  "src/app/api/crate/sleeve/route.ts",
  "src/app/api/crate/sleeves/route.ts",
  "src/lib/musicDiscovery.ts",
];
for (const file of DIRECT) {
  const src = readFileSync(file, "utf8");
  const calls = src
    .split("\n")
    .filter((line) => {
      const code = line.trim();
      if (code.startsWith("//") || code.startsWith("*")) return false;
      return code.includes("lookupItunesTrack(");
    });
  check(`${file} asks both catalogues`, calls.length === 0, calls.join(" | "));
}

// Deezer must be as strict about matching as Apple is. A search is a
// relevance search: ask for an obscure track by a famous artist and you
// get their hits back. Wrong cover art is not a near miss, it is the
// page telling somebody a confident lie about what they are looking at.
const deezer = readFileSync("src/lib/deezer.ts", "utf8");

// Tested rather than grepped. The first version of this check looked for
// the word "artistMatches" in the file, which stayed true when the line
// using it was deleted - a check that passes while the thing it checks
// is gone is worse than no check.
const HITS: DeezerTrack[] = [
  { title: "Sunshine", artist: { name: "Cleo Sol" }, preview: "p", album: { cover_xl: "c" } },
  { title: "Umbrella", artist: { name: "Rihanna" }, preview: "p", album: { cover_xl: "c" } },
];
check(
  "Deezer finds the record that was asked for",
  findMatch(HITS, "Sunshine", "Cleo Sol")?.artist?.name === "Cleo Sol"
);
check(
  "and will not hand back another artist's song",
  findMatch(HITS, "Sunshine", "Some Unknown Artist") === undefined
);
check(
  "or the right artist's wrong song",
  findMatch(HITS, "A Song They Never Recorded", "Cleo Sol") === undefined
);
// A parenthetical is furniture, not a different record.
check(
  "a version suffix still matches",
  findMatch(
    [{ title: "Sunshine (Radio Edit)", artist: { name: "Cleo Sol" }, preview: "p" }],
    "Sunshine",
    "Cleo Sol"
  ) !== undefined
);
check("and refuses a result that does not match", /if \(!match\) return empty;/.test(deezer));
check(
  "a Deezer answer claims no year rather than guessing one",
  /year: null/.test(deezer)
);
// Deezer answers 200 with an error object rather than a status code, so
// an ok response is not the same as an answer.
check("a 200 carrying an error is not treated as an answer", /data\.error/.test(deezer));

console.log(
  failures === 0
    ? "\nApple first for the years, Deezer the moment Apple says no."
    : `\n${failures} way(s) a shelf can go blank when one catalogue is busy.`
);
process.exit(failures === 0 ? 0 : 1);
