/**
 * The following system stays reachable.
 *
 * It did not break; it went quiet, which is harder to notice. The feed
 * could be filtered to people you follow and the ONLY place to follow
 * anybody was their profile page - so the filter was a door with nothing
 * behind it, and a member who never guessed a profile URL never followed
 * a soul. A feature can be fully wired, fully tested and completely
 * unreachable.
 *
 * So these check reachability, not wiring.
 */
import { readFileSync } from "node:fs";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

const card = readFileSync("src/components/PostCard.tsx", "utf8");
const feed = readFileSync("src/app/page.tsx", "utf8");
const button = readFileSync("src/components/FollowButton.tsx", "utf8");
const profile = readFileSync("src/app/profile/[username]/page.tsx", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");

// ---- you can follow somebody from where you met them ----
check("the feed card can draw a follow button", /<FollowButton/.test(card));
check("and the feed hands it the state", /following=\{following \? following\.has\(post\.user_id\) : undefined\}/.test(feed));
check("and the page actually loads that state", /\.from\("follows"\)/.test(feed));

// The state is loaded for EVERY view, not only the Following tab. That
// was the bug: the filter fetched it, so every other view of the feed
// had no idea and could draw nothing.
const load = feed.indexOf('.from("follows")');
const gate = feed.lastIndexOf("if (user) {", load);
const tabGate = feed.lastIndexOf("followingOnly", load);
check(
  "the follow list is loaded on every feed view, not just the Following tab",
  gate > tabGate,
  gate > tabGate ? "" : "loaded behind the Following tab again"
);

// ---- and it never lies about the state ----
//
// A Follow button on somebody you already follow UNFOLLOWS them when
// pressed. Not knowing has to mean showing nothing.
check(
  "a card that does not know shows no button",
  /following !== undefined && currentUserId && currentUserId !== post\.userId/.test(card)
);
check(
  "a failed lookup is not read as following nobody",
  /following = followRows \? new Set/.test(feed)
);
check("you cannot follow yourself from the feed", /currentUserId !== post\.userId/.test(card));

// ---- the profile still has the full-size one ----
check("the profile keeps its own follow button", /<FollowButton/.test(profile));
check("and the compact variant is a variant, not a fork", /compact = false/.test(button));

// ---- the door still leads somewhere ----
check("the feed can still be filtered to people you follow", /followingOnly/.test(feed));

// ---- and it is visible ----
check("the chip has styling", /\.follow-chip \{/.test(css));
check(
  "and following reads differently from not following",
  /\.follow-chip\.is-following \{/.test(css)
);

// ---- following means something you can see ----
//
// The follows table has been in the schema the whole time and nothing
// ever read it back: no count anywhere went up, no list you appeared on,
// no way to see who had followed you. A button whose effect is invisible
// is the same as a button that does nothing, which is the other half of
// why this system went quiet.
{
  const lib = readFileSync("src/lib/follows.ts", "utf8");
  const list = readFileSync("src/components/FollowList.tsx", "utf8");

  check("a profile shows how many follow it", /followCounts\(supabase, profile\.id\)/.test(profile));
  check(
    "and both counts lead to the list behind them",
    /\/followers`\}/.test(profile) && /\/following`\}/.test(profile)
  );

  // Counted BY the database. Selecting the rows to measure their length
  // moves every follower across the wire to print one number.
  // Scoped to the function it is about. The first version read from
  // "followCounts" to the end of the file and tripped over
  // `data.length` inside followList - a check failing for a reason that
  // has nothing to do with what it claims.
  const countsBody = lib.slice(
    lib.indexOf("export async function followCounts"),
    lib.indexOf("export type FollowPerson")
  );
  check(
    "counts are counted by the database, not fetched and measured",
    /count: "exact", head: true/.test(countsBody) && !/\.length/.test(countsBody)
  );

  // A count that cannot load must not take the profile down with it.
  check("a failed count is a zero, not a broken page", /return \{ followers: 0, following: 0 \};/.test(lib));

  // Newest first is the whole point: it is how you see who just
  // followed you. The profiles query returns them in any order it likes.
  check(
    "the list is newest first",
    /\.order\("created_at", \{ ascending: false \}\)/.test(lib)
  );
  check("and is put back into that order after the join", /Put back into follow order/.test(lib));

  // One query for the people, not one per person.
  check("the profiles are fetched in one query", /\.in\("id", ids\)/.test(lib));

  // Both directions are one page. Two copies drift.
  check(
    "followers and following are one component, not two",
    /direction: "followers" \| "following"/.test(list)
  );
  check(
    "and each page can reach the other",
    /direction === "followers" \? "is-on" : ""/.test(list) &&
      /direction === "following" \? "is-on" : ""/.test(list)
  );
}

console.log(
  failures === 0
    ? "\nYou can follow someone from where you found them."
    : `\n${failures} failing.`
);
process.exit(failures === 0 ? 0 : 1);
