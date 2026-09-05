/**
 * The wording on a profile.
 *
 * Two things to hold down. The {name} substitution has to reach every
 * label that uses it and leave the rest alone; and every string the
 * store renders has to come from the registry, or an admin who renames
 * something finds one heading stubbornly unchanged with no way to tell
 * why.
 *
 * Run: npx tsx scripts/profile-labels-check.ts
 */
import { readFileSync } from "node:fs";
import {
  cleanProfileLabel,
  defaultProfileLabels,
  personalise,
  PROFILE_LABELS,
  MAX_PROFILE_LABEL,
} from "../src/lib/profileLabels";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

const defaults = defaultProfileLabels();
const named = personalise(defaults, "kim");

check(
  "{name} is replaced everywhere it appears",
  !Object.values(named).some((v) => v.includes("{name}")),
  Object.entries(named).filter(([, v]) => v.includes("{name}")).map(([k]) => k).join(", ")
);
check("a label using it reads as a person's", named.store_added === "kim's Favorites", named.store_added);
check(
  "labels without it are untouched",
  named.store_new === defaults.store_new && named.follow === defaults.follow
);
check(
  "a name appearing twice is replaced twice",
  personalise({ ...defaults, store_new: "{name} and {name}" }, "kim").store_new === "kim and kim"
);

// Every shipped label has to survive its own field.
const tooLong = PROFILE_LABELS.filter((l) => l.label.length > MAX_PROFILE_LABEL);
check("every shipped label fits the input", tooLong.length === 0, tooLong.map((l) => l.key).join(", "));
const unhinted = PROFILE_LABELS.filter((l) => !l.hint.trim());
check("every label explains what it is", unhinted.length === 0, unhinted.map((l) => l.key).join(", "));
check(
  "cleaning collapses whitespace rather than keeping it",
  cleanProfileLabel("  Top   Rated  ") === "Top Rated"
);

// The store must not print words the admin cannot reach.
const store = readFileSync("src/components/ProfileStore.tsx", "utf8");
const hardcoded = [...store.matchAll(/>\s*([A-Z][A-Za-z][A-Za-z &']{3,})\s*</g)]
  .map((m) => m[1].trim())
  .filter((text) => !text.startsWith("{"));
check(
  "no heading is hardcoded past the label registry",
  hardcoded.length === 0,
  hardcoded.join(" | ")
);

if (failures > 0) {
  console.error(`\n${failures} check${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
console.log("\nEvery word on a profile is the admin's, and knows whose page it is on.");
