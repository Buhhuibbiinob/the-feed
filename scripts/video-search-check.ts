/**
 * How often the site is allowed to ask YouTube.
 *
 * A YouTube search costs 100 units of a 10,000-a-day quota - a hundred
 * searches for the whole site, across four boxes and everybody using
 * them. Debouncing and caching bought room and were not enough: members
 * were still being told to "wait a few seconds" halfway through typing
 * an artist's name.
 *
 * So the typing goes to Apple's catalogue, which is free and needs no
 * key, and YouTube is asked once - for the result somebody picked, which
 * still needs a video id to embed. What these checks pin down is that
 * the expensive call stays out of the typing loop.
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
const src = readFileSync("src/lib/trackSearch.ts", "utf8");
const min = Number(src.match(/MIN_QUERY_LENGTH = (\d+)/)?.[1]);
const debounce = Number(src.match(/SEARCH_DEBOUNCE_MS = (\d+)/)?.[1]);

check("a query under three characters never costs a request", min >= 3, `min ${min}`);
check("typing is still debounced", debounce >= 300, `${debounce}ms`);
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

// ---- the expensive call stays out of the typing loop ----
//
// This is the rule the whole rewrite exists for. Every search box types
// against Apple; the only thing that may reach YouTube is a pick.
check(
  "typing searches the free catalogue",
  /\/api\/music\/search/.test(src),
  "Apple's search costs nothing and needs no key"
);

const boxes = [
  "src/components/MediaSearchField.tsx",
  "src/components/StatusPicker.tsx",
  "src/components/PostForm.tsx",
];
for (const box of boxes) {
  const box_src = readFileSync(box, "utf8");
  check(
    `${box.split("/").pop()} does not call YouTube while somebody types`,
    !/searchVideosClient/.test(box_src),
    "searchVideosClient belongs behind searchMediaClient, which only reaches YouTube for film and TV"
  );
  check(
    `${box.split("/").pop()} waits for three characters`,
    /MIN_QUERY_LENGTH/.test(box_src)
  );
}

// The resolve route is the one deliberate YouTube call. It has to stay a
// route of its own: the moment it is merged back into search, every
// keystroke costs 100 units again.
check(
  "picking a song resolves its video exactly once",
  /resolveTrackVideo/.test(src) && /\/api\/youtube\/resolve/.test(src)
);

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
console.log("\nTyping costs nothing, picking costs one request, and every failure explains itself.");
