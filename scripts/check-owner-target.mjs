#!/usr/bin/env node
/**
 * Every form on the Customize card has to say which page it is editing.
 *
 * The card used to be gated on "is this my own profile", so the server
 * could take the caller's own id and be right every time. It isn't any
 * more: an admin gets the same controls on a bot's page, and the only
 * thing that tells the server which page an edit is for is a hidden
 * owner_id in the form.
 *
 * Leave it off a form and nothing breaks loudly. The action falls back
 * to the caller's own id and cheerfully edits the ADMIN'S profile - the
 * bot's page just quietly refuses to change, which reads as a bug in
 * saving rather than as a missing field. That is a bad failure to debug
 * from the outside, so it fails the build instead.
 *
 * Run: node scripts/check-owner-target.mjs
 */
import { readFileSync } from "node:fs";

// The components rendered inside the Customize card, plus the modules
// on the page that an owner edits in place.
const FILES = [
  "src/components/AvatarPicker.tsx",
  "src/components/ProfileCustomize.tsx",
  "src/components/StatusPicker.tsx",
  "src/components/ObsessedPicker.tsx",
  "src/components/ProfileSongPicker.tsx",
  "src/components/FavoritesEditor.tsx",
  "src/components/MoodRing.tsx",
  "src/components/BlurbsEditor.tsx",
  "src/components/TopConnections.tsx",
  "src/components/PageAppearanceEditor.tsx",
  "src/components/PageBackgroundPicker.tsx",
  "src/components/StickerLayer.tsx",
];

const problems = [];

for (const file of FILES) {
  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    // A renamed or deleted file is a change to this list, not a silent pass.
    problems.push(`${file}: listed here but missing. Update the list or restore the file.`);
    continue;
  }

  const lines = source.split("\n");
  lines.forEach((line, index) => {
    if (!/^\s*<form\b/.test(line)) return;

    // The field is expected inside the form, before anything else can
    // submit. Looking ahead a handful of lines rather than parsing the
    // JSX: it is either the first thing in the form or it is wrong.
    const window = lines.slice(index, index + 6).join("\n");
    if (!/name="owner_id"/.test(window)) {
      problems.push(
        `${file}:${index + 1}: <form> with no owner_id. Without it this saves to whoever is signed in, not the page being edited.`
      );
    }
  });
}

if (problems.length > 0) {
  console.error("Customize forms missing their target page:\n");
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(
    `\n${problems.length} form${problems.length === 1 ? "" : "s"} to fix. Add:\n` +
      '  <input type="hidden" name="owner_id" value={ownerId} />\n'
  );
  process.exit(1);
}

console.log(`owner_id present on every Customize form (${FILES.length} files).`);
