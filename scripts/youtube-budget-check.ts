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
const ALLOWED_TO_ASK = [
  "src/app/api/music/play/route.ts",
  "src/app/api/youtube/resolve/route.ts",
  "src/app/api/youtube/search/route.ts",
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
  "and the routes that should claim it still do",
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

console.log(
  failures === 0
    ? `\nThe allowance degrades into stale shelves, not dead buttons. ${Math.floor(reserve / SEARCH_UNITS)} searches held back for people.`
    : `\n${failures} way(s) the day's allowance can be spent on the wrong thing.`
);
process.exit(failures === 0 ? 0 : 1);
