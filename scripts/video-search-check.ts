/**
 * How often the site is allowed to ask YouTube.
 *
 * Every search costs 100 units of a 10,000-a-day quota - a hundred
 * searches for the whole site, across three boxes and everybody using
 * them. So the interesting question is not "does search work" but "how
 * many requests does typing one song name cost", and that is a number
 * worth pinning: it went 429 in real use, and the difference between
 * fine and broken is entirely in these three rules.
 *
 * Run: npx tsx scripts/video-search-check.ts
 */
import { readFileSync } from "node:fs";
import { describeSearchFailure } from "../src/lib/youtube";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

// The module is "use client" and holds a fetch, so it is read as text
// rather than imported - the point here is the policy, not the network.
const src = readFileSync("src/lib/videoSearch.ts", "utf8");
const min = Number(src.match(/MIN_QUERY_LENGTH = (\d+)/)?.[1]);
const debounce = Number(src.match(/SEARCH_DEBOUNCE_MS = (\d+)/)?.[1]);

check("a query under three characters never costs a request", min >= 3, `min ${min}`);
check("the debounce is at least half a second", debounce >= 500, `${debounce}ms`);
check("answers are cached", /const cache = new Map/.test(src));
check(
  "the cache is keyed case-insensitively",
  /toLowerCase\(\)/.test(src),
  "'Lil Uzi' and 'lil uzi' are one search, not two"
);
check(
  "failures are NOT cached",
  /if \(answer\.error\) return;/.test(src),
  "a 429 clears on its own; caching it would keep showing an error that stopped being true"
);
check("the cache is bounded", /MAX_CACHED/.test(src), "a long-lived tab must not grow forever");

// ---- what each failure tells somebody ----
const messages = {
  notConfigured: describeSearchFailure({ reason: "not-configured" }),
  quota: describeSearchFailure({ reason: "quota" }),
  rate: describeSearchFailure({ reason: "rate-limited" }),
  http: describeSearchFailure({ reason: "http", status: 500 }),
  network: describeSearchFailure({ reason: "network" }),
};
check("every failure says something different", new Set(Object.values(messages)).size === 5);
check(
  "none of them says 'no matches'",
  !Object.values(messages).some((m) => /no match/i.test(m)),
  "that was the bug: every failure claimed the song did not exist"
);
// 429 and 403 are hours apart in what they mean. Telling somebody to
// come back tomorrow when it clears in ten seconds is its own small
// failure.
check("rate-limited says wait, not come back tomorrow", /seconds/i.test(messages.rate), messages.rate);
check("quota says tomorrow", /tomorrow/i.test(messages.quota), messages.quota);
check("a missing key names the key", /YOUTUBE_API_KEY/.test(messages.notConfigured));

if (failures > 0) {
  console.error(`\n${failures} check${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
console.log("\nTyping a song name costs one request, and every failure explains itself.");
