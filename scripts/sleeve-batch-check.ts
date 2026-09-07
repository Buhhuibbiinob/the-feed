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

check(
  "the timer handle is cleared before the flush runs, not inside it",
  /timer\.current = null;\s*\n\s*void latest\.current\?\.\(\);/.test(hook),
  "latest starts unset because it cannot be assigned until an effect runs; if the timer fired first, nothing was fetched AND the handle stayed set, so schedule() returned early forever and the queue was stranded for the life of the page - which is exactly 'it never loads until I refresh'"
);
check(
  "anything queued before the flush was wired still gets sent",
  /if \(queue\.current\.size > 0\) schedule\(\);/.test(hook)
);
check(
  "the shelf can tell 'on its way' from 'not in the catalogue'",
  /pending/.test(hook) && /waiting/.test(shelf),
  "both were a blank sleeve, so a finished shelf looked like a working one"
);
check(
  "a record with no cover and no clip is replaced rather than left blank",
  /const dead =/.test(shelf) && /SHOW/.test(shelf),
  "the server sends more than the shelf shows so there is something to swap in"
);

check(
  "a throttled lookup is told apart from a missing one",
  /throttled\?: boolean/.test(itunes) && /\.\.\.NO_TRACK_INFO, throttled/.test(itunes),
  "Apple answers 403 when asked too often and the old code returned that as all-nulls, identical to 'no such track'"
);
check(
  "the batch leaves a throttled lookup out of its answer",
  /!info\.throttled/.test(route),
  "reporting it as an empty answer made the browser cache 'no cover' for the life of the tab - which is how a Psychedelic shelf full of Hendrix and the Beatles came out blank"
);
check(
  "the client releases anything the batch did not answer for",
  /if \(item\.key in results\)/.test(hook) && /asked\.delete\(item\.key\)/.test(hook)
);
check(
  "and asks again, a bounded number of times",
  /MAX_ATTEMPTS/.test(hook) && /RETRY_MS/.test(hook),
  "a released key is never re-requested on its own: useOnScreen disconnects after the first sighting, so nothing would ever ask again"
);
check(
  "a record that really is missing is answered once and left alone",
  /attempts\.delete\(item\.key\)/.test(hook),
  "only refusals are retried, not genuine misses"
);

console.log(
  failures === 0
    ? "\nA screenful is one request, and it always finishes."
    : `\n${failures} failing.`
);
if (failures > 0) process.exit(1);
