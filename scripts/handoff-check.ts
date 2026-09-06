/**
 * Handing somebody a record.
 *
 * Two kinds of rule here. The ones about the note and the candidate list
 * are ordinary. The one that matters is that a "kept" count must only
 * ever be writable by the person who kept it - the moment a sender can
 * mark their own handoff as taken, "whose taste to trust" becomes a
 * number anybody can manufacture, and nothing on screen would look wrong.
 *
 * Run: npx tsx scripts/handoff-check.ts
 */
import { readFileSync } from "node:fs";
import { MAX_NOTE, cleanNote } from "../src/lib/handoffs";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

// ---- the note ----------------------------------------------------------

check("a note survives", cleanNote("the one I kept going on about") === "the one I kept going on about");
check("whitespace either side is trimmed", cleanNote("  hello  ") === "hello");
check(
  "an empty note is nothing, not an empty string",
  cleanNote("") === null && cleanNote("   ") === null,
  "a row storing '' would render an empty pair of quote marks"
);
check("a non-string is nothing", cleanNote(undefined) === null && cleanNote(42) === null);
check("a long note is cut, not refused", cleanNote("x".repeat(500))?.length === MAX_NOTE);
check(
  "the note is a line, not a review",
  MAX_NOTE <= 300,
  `${MAX_NOTE} characters - the review is already on the other end of the link`
);

// ---- the migration -----------------------------------------------------

const sql = readFileSync("supabase/migrations/012-handoffs.sql", "utf8");

check(
  "you cannot hand a record to yourself",
  /check \(from_user_id <> to_user_id\)/.test(sql)
);
check(
  "the same record cannot be handed to the same person twice",
  /create unique index[\s\S]*?handoffs \(from_user_id, to_user_id, post_id\)/.test(sql),
  "handing it again is forgetting, not a second recommendation"
);
check("row level security is on", /alter table public\.handoffs enable row level security/.test(sql));
check(
  "a handoff is private to the two people involved",
  /for select[\s\S]*?using \(auth\.uid\(\) = from_user_id or auth\.uid\(\) = to_user_id\)/.test(sql),
  "it is a note passed across a table, not a post"
);

// The rule the whole feature's honesty rests on.
const updatePolicy = sql.slice(sql.indexOf("for update"));
check(
  "only the recipient can mark a handoff kept",
  /using \(auth\.uid\(\) = to_user_id\)/.test(updatePolicy) &&
    /with check \(auth\.uid\(\) = to_user_id\)/.test(updatePolicy),
  "a sender who can write kept_at can manufacture their own reputation"
);
check(
  "the update policy has a with-check as well as a using",
  /with check/.test(updatePolicy),
  "using alone lets a row be updated INTO a state the policy would not have allowed"
);
check(
  "the migration can be run twice",
  (sql.match(/if not exists/g) ?? []).length >= 3 && (sql.match(/drop policy if exists/g) ?? []).length >= 4
);
check(
  "deleting a review takes its handoffs with it",
  /post_id uuid not null references public\.posts \(id\) on delete cascade/.test(sql)
);

// ---- the action --------------------------------------------------------

const action = readFileSync("src/app/actions/handoffs.ts", "utf8");
check(
  "handing it over twice is not an error",
  /error\.code !== "23505"/.test(action),
  "the unique index deduplicates; telling somebody off for forgetting is worse"
);
check(
  "a missing migration says so",
  /isMissingSchema/.test(action) && /migration 012/.test(action),
  "otherwise the button silently does nothing"
);
check(
  "keeping is scoped to the recipient in the query too",
  /\.eq\("to_user_id", user\.id\)/.test(action),
  "belt as well as the policy"
);
check(
  "the sender cannot pick themselves",
  /toUserId === user\.id/.test(action),
  "the check constraint says so too, but it reaches the member as a wall of Postgres"
);

// ---- who can be handed to ---------------------------------------------

const lib = readFileSync("src/lib/handoffs.ts", "utf8");
check(
  "bots are not in the list",
  /is_bot !== true/.test(lib),
  "a list of names where half of them will never listen to it is not a list of people"
);
check(
  "the review's author is not in the list",
  /row\.id !== authorId/.test(lib),
  "handing a review back to whoever wrote it is the one case that is definitely not a recommendation"
);
check("banned members are not in the list", /\.eq\("banned", false\)/.test(lib));

console.log(
  failures === 0
    ? "\nOne record, one person, and only they can say they took it."
    : `\n${failures} failing.`
);
process.exit(failures === 0 ? 0 : 1);
