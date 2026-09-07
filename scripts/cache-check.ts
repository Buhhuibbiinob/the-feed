/**
 * Every outward call is actually cached.
 *
 * This exists because the failure it guards against is invisible. A
 * fetch written as `fetch(url, { next: { revalidate: 3600 } })` looks
 * cached, reads as cached, and had comments all over this codebase
 * describing the caching it was doing. It was not cached at all:
 * `next.revalidate` sets a cache LIFETIME, and the thing that opts in is
 * `cache`, which defaults to "auto no cache" - and on a route that uses
 * request-time APIs, which every page here does because it reads the
 * session, an auto-no-cache fetch goes out on every single request.
 *
 * Nothing breaks when that regresses. The site works. It just quietly
 * spends a hundred YouTube units per page view out of ten thousand a
 * day, and gets 403ed by Apple for asking twenty times a minute, and
 * nobody finds out until the rails start saying "rate limited" and it
 * looks like somebody else's outage.
 *
 * So it is checked here instead of trusted.
 *
 * Run: npx tsx scripts/cache-check.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

const LIB = "src/lib";
const files = readdirSync(LIB).filter((f) => f.endsWith(".ts"));

// A fetch that names a revalidate window is a fetch that MEANT to be
// cached. Those are the ones that must go through cachedFetch, which
// sets force-cache alongside the window.
const offenders: string[] = [];
for (const file of files) {
  if (file === "cachedFetch.ts") continue;
  const src = readFileSync(join(LIB, file), "utf8");
  for (const line of src.split("\n")) {
    const code = line.trim();
    // A comment explaining the trap is not the trap. This flagged its
    // own explanation on the first run, which is funny once.
    if (code.startsWith("//") || code.startsWith("*") || code.startsWith("/*")) continue;
    if (!code.includes("next:") || !code.includes("revalidate")) continue;
    // Anything that has already opted in on the same line is fine.
    if (code.includes("force-cache")) continue;
    offenders.push(`${file}: ${line.trim()}`);
  }
}
check(
  "no fetch asks for a revalidate window without opting into the cache",
  offenders.length === 0,
  offenders.join(" | ")
);

// The helper has to keep doing both halves of its job.
const helper = readFileSync(join(LIB, "cachedFetch.ts"), "utf8");
check('the helper opts in with force-cache', helper.includes('cache: "force-cache"'));
check("the helper still passes the lifetime through", helper.includes("revalidate: revalidateSeconds"));
check(
  "a failed response is retried without the cache",
  helper.includes('cache: "no-store"'),
  "force-cache stores a 403 as happily as a 200, so a spent quota would be served back for the whole window and the rail would keep saying 'rate limited' long after the limit cleared"
);

// The callers that were burning the most.
const youtube = readFileSync(join(LIB, "youtube.ts"), "utf8");
check("the YouTube search goes through it", youtube.includes("cachedFetch("));
const itunes = readFileSync(join(LIB, "itunes.ts"), "utf8");
check("so does every iTunes lookup", itunes.includes("cachedFetch("));
const lastfm = readFileSync(join(LIB, "lastfm.ts"), "utf8");
check("and every Last.fm call", lastfm.includes("cachedFetch("));

console.log(
  failures === 0
    ? "\nThe caching the comments describe is the caching that happens."
    : `\n${failures} failing.`
);
if (failures > 0) process.exit(1);
