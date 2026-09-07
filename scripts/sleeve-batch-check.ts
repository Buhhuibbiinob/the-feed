/**
 * A batch of sleeve lookups is bounded.
 *
 * The shelf that never finished loading was not slow code, it was too
 * many requests. An obscure tag misses on nearly every record, and a
 * miss used to cost three iTunes calls rather than one - so a screenful
 * became about seventy calls against a limit of roughly twenty a minute,
 * with two and a half seconds of backoff on top of every throttle.
 *
 * Nothing here can talk to Apple, so what is checked is the shape of the
 * work: that the batch caps what it takes, that it stops waiting, and
 * that it does not ask for the expensive fallback.
 *
 * Run: npx tsx scripts/sleeve-batch-check.ts
 */
import { readFileSync } from "node:fs";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

const route = readFileSync("src/app/api/crate/sleeves/route.ts", "utf8");
const itunes = readFileSync("src/lib/itunes.ts", "utf8");
const hook = readFileSync("src/lib/useSleeves.ts", "utf8");
const rack = readFileSync("src/components/RecordRack.tsx", "utf8");
const shelf = readFileSync("src/components/ShelfRecords.tsx", "utf8");

check("the batch has a size cap", /MAX_ITEMS\s*=\s*\d+/.test(route));
check(
  "and a deadline, so the browser is never waiting on the slowest lookup",
  /DEADLINE_MS/.test(route) && /Promise\.race/.test(route)
);
check(
  "the batch does not ask for the artist-catalogue fallback",
  /deep:\s*false/.test(route),
  "two extra requests per miss, and a batch is mostly misses"
);
check(
  "the fallback still exists for a single lookup, where somebody is waiting on one record",
  /deep\s*=\s*true/.test(itunes) && /!match && !throttled && deep/.test(itunes)
);

// The hook keeps its queue in refs, so one hook is one queue. Calling it
// per record gives every record a queue of its own holding one item,
// which is one HTTP call per record - slower than what it replaced.
for (const [name, src] of [
  ["the rack", rack],
  ["the shelf", shelf],
] as [string, string][]) {
  const calls = src.match(/useSleeves\(\)/g)?.length ?? 0;
  check(`${name} has one queue, not one per record`, calls === 1, `${calls} calls to useSleeves()`);
}

check(
  "a key that came back with no answer is not asked for again",
  /asked\.add\(ask\.key\)/.test(hook),
  "otherwise a record Apple does not have is requested on every scroll, forever"
);
check(
  "but a failed batch releases its keys, so a throttle is not remembered as an answer",
  /asked\.delete\(item\.key\)/.test(hook)
);

console.log(
  failures === 0
    ? "\nA screenful is one request, and it always finishes."
    : `\n${failures} failing.`
);
if (failures > 0) process.exit(1);
