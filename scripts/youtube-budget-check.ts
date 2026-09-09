/**
 * The day's hundred searches, spent in the right order.
 *
 * YouTube allows 10,000 units a day and a search costs 100, so the whole
 * site gets a hundred of them between everybody. When that ran out the
 * thing that stopped working was the play button - because nothing
 * distinguished a shelf refreshing itself from a person waiting on a
 * record, and the shelves had all morning to spend it first.
 *
 * Three properties hold this together, and all three are the kind that
 * break silently:
 *
 *  1. Background work cannot spend the whole day. If the reserve ever
 *     reaches zero, a busy afternoon takes the play button down with it.
 *  2. The default is background. A new call site that forgets to say
 *     what it is must not be given the reserve by accident - the wrong
 *     default there is a shelf outbidding a person.
 *  3. Only things a person is waiting on ask for priority. The moment a
 *     page refresh claims it, the reserve is not a reserve.
 *
 * Run: npx tsx scripts/youtube-budget-check.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  BACKGROUND_SHARE,
  DAILY_UNITS,
  SEARCH_UNITS,
  budgetFor,
} from "../src/lib/youtubeBudget";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

const reserve = DAILY_UNITS - budgetFor("background");
check(
  "background work cannot spend the whole day",
  budgetFor("background") < DAILY_UNITS,
  `${budgetFor("background")} of ${DAILY_UNITS}`
);
check(
  "the reserve is worth having",
  reserve >= SEARCH_UNITS * 10,
  `${reserve} units, ${Math.floor(reserve / SEARCH_UNITS)} searches`
);
check("a person may spend the whole day if it comes to it", budgetFor("user") === DAILY_UNITS);
check("the share is a share", BACKGROUND_SHARE > 0 && BACKGROUND_SHARE < 1);

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

// The default has to be background, in the code and not just in the
// comment above it.
const lib = readFileSync("src/lib/youtube.ts", "utf8");
check(
  "a search with nothing said about it is background work",
  /options\.priority \?\? "background"/.test(lib)
);
check("the cache is read before anything is spent", lib.indexOf("readSearch(") < lib.indexOf("spendUnits("));
check("a spent day serves what it remembers", /if \(remembered\) return \{ videos: remembered\.videos \}/.test(lib));

// Only the things a person waits on may claim the reserve. This is the
// one that will actually catch something one day: a rail added in six
// months, copying a route that says priority: "user", quietly taking the
// play button's allowance with it.
// music/play used to be here. It is gone: the shelves no longer fall
// back to a video for a record with no clip, so nothing on a music
// surface spends YouTube quota at all any more.
const ALLOWED_TO_ASK = [
  "src/app/api/youtube/resolve/route.ts",
  "src/app/api/youtube/search/route.ts",
  // Writing a review. One search per review WRITTEN, not per view, and
  // it is what gives the review a player - a review of a song with no
  // way to hear the song is half a review. Somebody is watching a
  // spinner when this runs.
  "src/app/actions/posts.ts",
  // The admin backfill, which is the same job for reviews already
  // written. An admin standing at the page having deliberately pressed
  // a button is as much a person waiting as anybody typing in a search
  // box, and it is capped at ten posts a press so it cannot quietly
  // become a background drain.
  "src/lib/playerBackfill.ts",
];
const claiming = SOURCES.filter(
  (f) => !f.endsWith("youtube.ts") && /priority:\s*"user"/.test(readFileSync(f, "utf8"))
);
const wrong = claiming.filter((f) => !ALLOWED_TO_ASK.includes(f));
check(
  "only a person's own request claims the reserve",
  wrong.length === 0,
  wrong.join(", ")
);
check(
  "and the places that should claim it still do",
  ALLOWED_TO_ASK.every((f) => claiming.includes(f)),
  `${claiming.length} of ${ALLOWED_TO_ASK.length}`
);

// An empty answer must never be written down. A search that came back
// with nothing is usually one that failed in a way the code cannot see,
// and remembering it keeps a shelf empty for as long as the row lives.
const budget = readFileSync("src/lib/youtubeBudget.ts", "utf8");
check(
  "an empty answer is not remembered as an answer",
  /videos\.length === 0\) return/.test(budget)
);

// ---- the burst limit is waited out, not handed to a person ----
//
// "Searching a bit fast for YouTube. Wait a few seconds and try again."
// on an empty shelf. That is rateLimitExceeded - the BURST limit, not
// the daily quota, and it clears in seconds. It happened because a page
// fires several searches at once: a shelves page asks for a film shelf
// and a scene shelf together, and filmShelf itself tries several lanes
// in parallel, so four or five requests left shoulder to shoulder.
//
// Nothing was wrong with the key or the allowance. And being told to
// retry by hand is the site asking a person to do a thing it could
// obviously do itself.
{
  const lib = readFileSync("src/lib/youtube.ts", "utf8");
  check("searches go out one at a time", /function queued</.test(lib) && /queued\(async/.test(lib));
  check("a burst refusal is waited out once", /BURST_BACKOFF_MS/.test(lib));
  // Google returns rateLimitExceeded under 403 as well as 429, and
  // reading only the number is the mistake failureFromBody exists to
  // stop being made.
  check(
    "and it is recognised on 403 as well as 429",
    /first\.status !== 429 && first\.status !== 403/.test(lib)
  );
  // A failed search must not wedge every search behind it.
  check("one failed search cannot block the line", /line = mine\.catch/.test(lib));
}

console.log(
  failures === 0
    ? `\nThe allowance degrades into stale shelves, not dead buttons. ${Math.floor(reserve / SEARCH_UNITS)} searches held back for people.`
    : `\n${failures} way(s) the day's allowance can be spent on the wrong thing.`
);
process.exit(failures === 0 ? 0 : 1);
