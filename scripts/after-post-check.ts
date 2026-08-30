/**
 * The one thing offered after a review is the right one for that person.
 *
 * This ladder is the whole retention bet: members who fill in a profile
 * become the ones who review five, nine, eleven times, and members who
 * skip it post once and leave. Until now nothing anywhere asked them to
 * do it. Getting the order wrong - offering a club to somebody who still
 * has no avatar - wastes the one moment they are definitely paying
 * attention, so the order is pinned down here rather than left to
 * whoever edits the function next.
 *
 * Run: npx tsx scripts/after-post-check.ts
 */
import { chooseNextStep, type AfterPostFacts } from "../src/lib/afterPost";

const BASE: AfterPostFacts = {
  username: "kim",
  hasAvatar: true,
  hasBanner: true,
  reviewCount: 4,
  club: { id: "club-1", name: "Dolly Parton" },
  foundedClub: false,
};

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

// The avatar outranks everything, including a club they just founded.
{
  const step = chooseNextStep({ ...BASE, hasAvatar: false, hasBanner: false, foundedClub: true });
  check("no avatar wins over a founded club", step.kind === "avatar", step.kind);
  check("avatar step points at the editor", step.href === "/profile/kim#customize", step.href);
}

// A first review says so; a fifth doesn't pretend to be one.
{
  const first = chooseNextStep({ ...BASE, hasAvatar: false, reviewCount: 1 });
  const later = chooseNextStep({ ...BASE, hasAvatar: false, reviewCount: 9 });
  check("first review is acknowledged", first.text.includes("first one"), first.text);
  check("ninth review is not called a first", !later.text.includes("first one"), later.text);
}

// Banner is next, and lands in the same place.
{
  const step = chooseNextStep({ ...BASE, hasBanner: false, foundedClub: true });
  check("banner comes before the club", step.kind === "banner", step.kind);
  check("banner step points at the editor", step.href === "/profile/kim#customize", step.href);
}

// Only once the page is theirs does the club get the slot.
{
  const founded = chooseNextStep({ ...BASE, foundedClub: true });
  check("founded club is offered", founded.kind === "club", founded.kind);
  check("founded club says it is theirs", founded.text.includes("yours"), founded.text);
  check("founded club links to it", founded.href === "/clubs/club-1", founded.href);

  const existing = chooseNextStep(BASE);
  check("existing club is not claimed as founded", !existing.text.includes("yours"), existing.text);
}

// Nothing left to offer: still a step, never a dead end.
{
  const step = chooseNextStep({ ...BASE, club: null });
  check("always returns a step", step.kind === "profile", step.kind);
  check("fallback links somewhere real", step.href === "/profile/kim", step.href);
}

// A username with a space or a slash has to survive being a URL.
{
  const step = chooseNextStep({ ...BASE, username: "kim country", hasAvatar: false });
  check("username is encoded", step.href === "/profile/kim%20country#customize", step.href);
}

// Every rung needs words and a button, or the card renders half-empty.
{
  const rungs: AfterPostFacts[] = [
    { ...BASE, hasAvatar: false },
    { ...BASE, hasBanner: false },
    { ...BASE, foundedClub: true },
    BASE,
    { ...BASE, club: null },
  ];
  const complete = rungs.every((facts) => {
    const step = chooseNextStep(facts);
    return step.text.length > 20 && step.cta.length > 0 && step.href.startsWith("/");
  });
  check("every rung has text, a button and a link", complete);
}

if (failures > 0) {
  console.error(`\n${failures} check${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
console.log("\nThe step offered after a review is the right one for that member.");
