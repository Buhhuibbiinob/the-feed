/**
 * The emoji keyboard and the sticker pack are two doors onto one set of
 * drawings. This makes sure both doors open.
 *
 * Written after ten sprites - the whole sporty set and half of swag -
 * shipped with SVGs in public/stickers and no entry on the keyboard.
 * They were placeable as stickers and unusable as reactions, and the
 * only way to find that out was to scroll the Vibes tab looking for a
 * snapback that was never there. Nothing failed; it was just quietly
 * absent, which is the kind of bug that survives for weeks.
 *
 * Run: npx tsx scripts/emoji-keyboard-check.ts
 */
import { existsSync } from "node:fs";
import { CLASSIC_EMOJI, EMOJI_GROUPS, emojiLabel, spriteFor } from "../src/components/ClassicEmoji";
import { STICKER_PACK } from "../src/lib/stickerPack";

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

// ---- 5. The one that would have caught the bug: every sticker anybody
// might want to react with is reachable from the keyboard.
//
// "Bits" is exempt and stays exempt: an arrow and a strip of washi tape
// are page decoration, and a smiley is already a drawn FACE. Everything
// else - if it is good enough to stick on a profile it is good enough to
// put under a review.
const DECORATION_ONLY = new Set(["Bits"]);
const onKeyboard = new Set(allChars.map((c) => spriteFor(c)).filter(Boolean));
const stranded = STICKER_PACK.filter(
  (s) => !DECORATION_ONLY.has(s.group) && !onKeyboard.has(s.id)
);
check(
  "every non-decorative sticker is also on the keyboard",
  stranded.length === 0,
  stranded.map((s) => `${s.label} (${s.group})`).join(", ")
);

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
console.log("\nEvery drawing is reachable from both the keyboard and the sticker pack.");
