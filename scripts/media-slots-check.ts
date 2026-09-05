/**
 * The six boxes: whose choice wins, and what a pasted link means.
 *
 * Two things here are easy to get quietly wrong. A slot that overrides
 * the wrong box moves somebody's video to the other end of the page, and
 * a YouTube parser that only accepts one URL shape tells people their
 * link is broken when the id is plainly sitting in it.
 *
 * Run: npx tsx scripts/media-slots-check.ts
 */
import {
  ALL_SLOTS,
  isMediaSlot,
  isSlotIndex,
  parseYoutubeId,
  resolveSlots,
  type MediaSlot,
} from "../src/lib/mediaSlots";
import type { StoreItem } from "../src/lib/profileStore";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

const auto = (id: string): StoreItem => ({
  id, title: id, subtitle: "", coverUrl: "/c.jpg", href: `/post/${id}`,
});
const slot = (i: number, over: Partial<MediaSlot> = {}): MediaSlot => ({
  slot: i as MediaSlot["slot"], kind: "image", imageUrl: "/mine.jpg",
  youtubeId: null, title: null, subtitle: null, linkUrl: null, ...over,
});

// ---- which box is which ----
const automatic = [null, auto("a"), auto("b"), auto("c"), auto("d"), auto("e")];
const resolved = resolveSlots([slot(4, { kind: "video", youtubeId: "abc" })], automatic);
check("always six answers for six boxes", resolved.length === 6);
check("the filled box is the member's", isMediaSlot(resolved[4]));
check(
  "every other box is untouched",
  [1, 2, 3, 5].every((i) => !isMediaSlot(resolved[i])),
  "a slot must not move somebody's video to the other end of the page"
);
check("box 4 is still box 4", (resolved[4] as MediaSlot).youtubeId === "abc");
check(
  "an empty box with no automatic content is null, not a hole in the layout",
  resolveSlots([], [null, null, null, null, null, null]).every((x) => x === null)
);
check(
  "filling every box leaves nothing automatic",
  resolveSlots(ALL_SLOTS.map((i) => slot(i)), automatic).every(isMediaSlot)
);

// ---- what counts as a slot ----
check("slots are 0 to 5", ALL_SLOTS.every(isSlotIndex));
check("6 is not a slot", !isSlotIndex(6));
check("-1 is not a slot", !isSlotIndex(-1));
check("'2' is not a slot", !isSlotIndex("2"));

// ---- pasted links ----
// People paste whatever their browser gave them; all of these are the
// same video and all of them should work.
const ID = "dQw4w9WgXcQ";
for (const [label, input] of [
  ["a bare id", ID],
  ["a watch URL", `https://www.youtube.com/watch?v=${ID}`],
  ["a watch URL with junk after it", `https://www.youtube.com/watch?v=${ID}&t=42s&list=PL1`],
  ["a share link", `https://youtu.be/${ID}`],
  ["an embed URL", `https://www.youtube.com/embed/${ID}`],
  ["a short", `https://youtube.com/shorts/${ID}`],
  ["one pasted with spaces", `  https://youtu.be/${ID}  `],
] as const) {
  check(`${label} gives the id`, parseYoutubeId(input) === ID, String(parseYoutubeId(input)));
}
check("nothing is nothing", parseYoutubeId("") === null);
check("a sentence is not an id", parseYoutubeId("my favourite song") === null);
check("a ten-character word is not an id", parseYoutubeId("abcdefghij") === null);

if (failures > 0) {
  console.error(`\n${failures} check${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
console.log("\nSix boxes, the right one each time, and any link people paste.");
