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

// ---- the mix ----
//
// Four sources, each asked for the thing it is actually best at, and the
// division of labour is the whole design rather than a detail:
//
//   Apple    art, clip, year - but twenty calls a minute for the site
//   Deezer   art, clip, thirty times the headroom, no release date
//   Spotify  art and a RELIABLE YEAR, no clip worth depending on
//   YouTube  the only one that can play what nobody else stocks, at a
//            hundred quota units a search, so only on a press
//
// The year is the one that puts records in the right spot. A shelf
// headed 1994 checks each record against its own years, and an unknown
// year has to be allowed to stay - so before Spotify, everything Deezer
// rescued was undateable and could sit on any shelf at all.
{
  const catalogue = readFileSync("src/lib/catalogue.ts", "utf8");
  const spotify = readFileSync("src/lib/spotify.ts", "utf8");

  check("the year is asked for from Spotify", /lookupSpotifyTrack/.test(catalogue));
  check(
    "and only when a shelf is going to check it",
    /needYear && found\.year === null/.test(catalogue)
  );
  // Spotify stopped serving preview_url to newly registered apps, so a
  // play button built on it works or does not depending on when the app
  // was registered - the worst kind of feature.
  check(
    "no clip is ever taken from Spotify",
    /previewUrl: null/.test(catalogue) && !/spotify[^\n]*previewUrl:\s*(?!null)/i.test(catalogue)
  );
  check(
    "Spotify dates a record by its earliest release, not the top hit",
    /year < best/.test(spotify)
  );
  check("and matches on the artist too", /matchSpotifyTrack/.test(catalogue) === false && /artistMatches/.test(spotify));
  check(
    "a site with no Spotify credentials behaves as before",
    /SPOTIFY_CLIENT_ID \|\| !process\.env\.SPOTIFY_CLIENT_SECRET/.test(spotify)
  );

  // Only the two axes that claim a span pay for a year.
  const shelf = readFileSync("src/components/ShelfRecords.tsx", "utf8");
  check("only a shelf with a span asks for years", /needYear: !!span/.test(shelf));

  // And a row cached without a year on a scene shelf must not be handed
  // straight back to a year shelf undated forever.
  const batch = readFileSync("src/app/api/crate/sleeves/route.ts", "utf8");
  check("a cached row with no year gets dated when a year shelf needs one", /undated/.test(batch));
}

console.log(
  failures === 0
    ? "\nApple for all three, Deezer the moment Apple says no, Spotify for the year."
    : `\n${failures} way(s) a shelf can go blank when one catalogue is busy.`
);
process.exit(failures === 0 ? 0 : 1);
