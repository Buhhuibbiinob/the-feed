/**
 * The store layout stays on profile pages.
 *
 * The instruction was explicit: the iTunes treatment is for profiles,
 * not the homepage - the feed keeps the quiet edge-to-edge list. That is
 * a promise about CSS, and CSS has no idea what page it is on. One rule
 * written against `.panel-head` instead of `.profile-columns .panel-head`
 * would put blue shelf bars across the feed, and nothing would fail.
 *
 * So the block is checked rather than trusted: every selector in it has
 * to be anchored to something that only exists on a profile.
 *
 * Run: npx tsx scripts/profile-scope-check.ts
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const MARKER = "The profile page as the iTunes Music Store";
/** Anchors that only ever appear on a profile (or club) page. */
const PROFILE_ONLY = [
  ".profile-columns",
  ".profile-col-main",
  ".profile-col-side",
  ".itunes-",
  ".pf-",
  // The store front. ".store" is a generic enough name that this is only
  // safe while ProfileStore is the sole thing rendering it - which is
  // checked below rather than assumed, because the day somebody mounts
  // it on the homepage this list would silently start lying.
  ".store",
  // The sticker hub. Same reasoning and same proof as .store below:
  // profile-only because exactly one page mounts the component.
  ".sticker-hub",
];

/** Components whose CSS prefixes are trusted above, and must stay put. */
const PROFILE_ONLY_COMPONENTS = ["ProfileStore", "StickerHub"];

const css = readFileSync("src/app/globals.css", "utf8");
let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

const marker = css.indexOf(MARKER);
check("the store block is still in the stylesheet", marker !== -1);
if (marker === -1) process.exit(1);

// Back up to the "/*" that opens the banner comment the marker sits in.
// Slicing from the marker itself starts the string INSIDE a comment with
// no opening delimiter, so the comment stripper below cannot see it and
// the banner text gets read as a selector. (It did, the first time.)
const start = css.lastIndexOf("/*", marker);
const block = css.slice(start === -1 ? marker : start);
const selectors: string[] = [];
for (const rule of block.matchAll(/([^{}]+)\{/g)) {
  const head = rule[1].replace(/\/\*[\s\S]*?\*\//g, "").trim();
  if (!head || head.startsWith("@")) continue;
  for (const part of head.split(",")) {
    const sel = part.trim();
    if (sel) selectors.push(sel);
  }
}
check("the block has selectors to check", selectors.length > 0, `${selectors.length} found`);

const unscoped = selectors.filter((sel) => !PROFILE_ONLY.some((anchor) => sel.includes(anchor)));
check(
  "every store rule is anchored to a profile-only class",
  unscoped.length === 0,
  unscoped.length ? `would leak onto the feed: ${unscoped.join(" | ")}` : ""
);

// The Source column must stay hidden by default - it is revealed by a
// min-width query, so an unconditional `display:block` would put it on
// the phone where there is no room for a third column.
const sourceDefault = /\.itunes-source\s*\{[^}]*display:\s*none/.test(block);
check("the Source column is hidden until there is room for it", sourceDefault);

// The markup itself must stay on the profile. The CSS check above is
// only as true as this is: a generic class prefix is allowed as a
// profile-only anchor because exactly one page mounts the component
// that emits it.
for (const component of PROFILE_ONLY_COMPONENTS) {
  const importers = execSync(
    `grep -rl 'components/${component}' src --include=*.tsx --include=*.ts || true`,
    { encoding: "utf8" }
  )
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.endsWith(`components/${component}.tsx`));
  check(
    `only the profile page mounts ${component}`,
    importers.length === 1 && importers[0].includes("profile/"),
    importers.join(", ") || "nothing imports it"
  );
}

if (failures > 0) {
  console.error(`\n${failures} check${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
console.log("\nThe store layout cannot reach the homepage.");
