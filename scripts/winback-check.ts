/**
 * The rules that decide whether a real person gets an unsolicited email.
 *
 * Every one of these is a rule about not being a nuisance, and the cost
 * of getting one wrong is mail somebody didn't ask for - which is both
 * worse than sending nothing and how a sender ends up in spam folders.
 * So the decision is a pure function and it is pinned down here.
 *
 * Run: npx tsx scripts/winback-check.ts
 */
import { shouldNudge, QUIET_DAYS, COOLDOWN_DAYS, MAX_NUDGES, type NudgeCandidate } from "../src/lib/winback";

const NOW = new Date("2026-08-30T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

// Somebody who posted a fortnight ago and has never been nudged.
const DUE: NudgeCandidate = {
  id: "u1",
  username: "kim",
  lastPostAt: daysAgo(14),
  nudgeSentAt: null,
  nudgeCount: 0,
  digestSentAt: null,
  optedOut: false,
};

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

check("quiet a fortnight, never nudged: send", shouldNudge(DUE, NOW));

// Still around.
check(
  "posted yesterday: no",
  !shouldNudge({ ...DUE, lastPostAt: daysAgo(1) }, NOW)
);
check(
  `posted just inside ${QUIET_DAYS} days: no`,
  !shouldNudge({ ...DUE, lastPostAt: daysAgo(QUIET_DAYS - 1) }, NOW)
);
check(
  `posted just outside ${QUIET_DAYS} days: send`,
  shouldNudge({ ...DUE, lastPostAt: daysAgo(QUIET_DAYS + 1) }, NOW)
);

// Never posted at all. Not a win-back - a cold email to somebody who
// signed up and looked around, which is a different permission entirely.
check("never posted: no", !shouldNudge({ ...DUE, lastPostAt: null }, NOW));

// Cooldown.
check(
  "nudged last week: no",
  !shouldNudge({ ...DUE, nudgeSentAt: daysAgo(7), nudgeCount: 1 }, NOW)
);
check(
  `nudged ${COOLDOWN_DAYS + 1} days ago: send`,
  shouldNudge({ ...DUE, nudgeSentAt: daysAgo(COOLDOWN_DAYS + 1), nudgeCount: 1 }, NOW)
);

// A cap, so a dead account isn't mailed every month until the heat death
// of the universe.
check(
  `${MAX_NUDGES} already sent: no, whatever the cooldown says`,
  !shouldNudge({ ...DUE, nudgeCount: MAX_NUDGES, nudgeSentAt: daysAgo(365) }, NOW)
);

// Already being emailed about real activity.
check(
  "digest reached them two days ago: no",
  !shouldNudge({ ...DUE, digestSentAt: daysAgo(2) }, NOW)
);
check(
  "digest reached them months ago: send",
  shouldNudge({ ...DUE, digestSentAt: daysAgo(90) }, NOW)
);

// The off switch is the off switch.
check("opted out: no", !shouldNudge({ ...DUE, optedOut: true }, NOW));
check(
  "opted out beats every other reason to send",
  !shouldNudge({ ...DUE, optedOut: true, lastPostAt: daysAgo(400) }, NOW)
);

if (failures > 0) {
  console.error(`\n${failures} check${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
console.log("\nNobody gets a nudge who shouldn't.");
