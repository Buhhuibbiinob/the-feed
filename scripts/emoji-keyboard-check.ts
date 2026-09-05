/**
 * Every drawing on the emoji keyboard is reachable and has a file.
 *
 * This used to also check the sticker pack, because the drawings had two
 * doors onto them and ten of them shipped with only one - placeable as
 * stickers, unusable as reactions. The sticker pack is gone now, so the
 * keyboard is the only door and public/stickers exists purely to feed
 * it: an SVG in there with no keyboard entry is now dead weight rather
 * than a half-missing feature, and one MISSING is still a hole in a
 * grid of hand-drawn glyphs.
 *
 * Run: npx tsx scripts/emoji-keyboard-check.ts
 */
import { existsSync, readdirSync } from "node:fs";
import { CLASSIC_EMOJI, EMOJI_GROUPS, emojiLabel, spriteFor } from "../src/components/ClassicEmoji";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

const faces = new Set(CLASSIC_EMOJI);
const allChars = EMOJI_GROUPS.flatMap((g) => g.chars);

// ---- 1. Nothing on the keyboard falls through to the system's own art.
// This is the entire reason ClassicEmoji exists: one un-drawn character
// puts an Apple emoji in the middle of a grid of hand-drawn ones.
for (const group of EMOJI_GROUPS) {
  const undrawn = group.chars.filter((c) => !spriteFor(c) && !faces.has(c));
  check(
    `${group.name}: all ${group.chars.length} keys are drawn here`,
    undrawn.length === 0,
    undrawn.length ? `${undrawn.length} would fall back to system art` : ""
  );
}

// ---- 2. Every sprite the keyboard names has a file behind it.
const missingFiles = allChars
  .map((c) => spriteFor(c))
  .filter((id): id is string => !!id)
  .filter((id) => !existsSync(`public/stickers/${id}.svg`));
check("every sprite on the keyboard has an SVG", missingFiles.length === 0, missingFiles.join(", "));

// ---- 3. No key appears twice in one tab.
for (const group of EMOJI_GROUPS) {
  const dupes = group.chars.filter((c, i) => group.chars.indexOf(c) !== i);
  check(`${group.name}: no key appears twice`, dupes.length === 0, dupes.join(" "));
}

// ---- 4. Every key is searchable by a name somebody would actually type.
const unlabelled = allChars.filter((c) => emojiLabel(c) === "emoji");
check("every key has a search label", unlabelled.length === 0, `${unlabelled.length} unlabelled`);

// ---- 5. No sprite file is orphaned.
// public/stickers is now fed by exactly one thing. A file nobody names
// is 2KB nobody will ever remove on purpose, so it gets reported.
const referenced = new Set(allChars.map((c) => spriteFor(c)).filter(Boolean));
const orphans = readdirSync("public/stickers")
  .filter((f) => f.endsWith(".svg"))
  .map((f) => f.replace(/\.svg$/, ""))
  .filter((id) => !referenced.has(id));
check("no sprite file is unreachable", orphans.length === 0, orphans.join(", "));

// ---- 6. A tab nobody can reach the bottom of is a tab that hides things.
// 31 keys is five thumb-rows; the Vibes tail that prompted this was 42
// and the swag sat below the fold of a fold.
for (const group of EMOJI_GROUPS) {
  check(
    `${group.name}: ${group.chars.length} keys is a scrollable size`,
    group.chars.length <= 36,
    group.chars.length > 36 ? "split it" : ""
  );
}

if (failures > 0) {
  console.error(`\n${failures} check${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
console.log("\nEvery drawing on the keyboard has a file, and every file is used.");
