/**
 * The Retina article, turned into assertions.
 *
 * The document the design is being held to is Marc Edwards' 2010 piece on
 * building for the iPhone 4 display. Most of it is Photoshop workflow, but
 * two things in it are real design law and both are checkable:
 *
 *   1. The object recipe. Page 9 has a live PSD of an iOS Delete button
 *      with its layer group open: Outer, then the body carrying Stroke,
 *      Gradient Overlay, Inner Shadow, Inner Glow and Drop Shadow, then
 *      Shine, then the letterpressed label. "Outer" - the pale ring
 *      sitting outside the dark stroke - is the layer this site did not
 *      have, and it is the one that makes a control read as moulded
 *      rather than printed. You can see it plainly on the "+" button on
 *      page 5, which the article prints at 1x and 2x side by side.
 *
 *   2. Integer values. "Layer styles can only contain integer values...
 *      if you edit a drop shadow offset to be 1px with the document at 2x
 *      and then scale it down, the value will end up as 1px because it
 *      can't be 0.5px." Every offset and every ring in that era's chrome
 *      is a whole number, and the Image Size dialog on page 10 is set to
 *      "Nearest Neighbor (preserve hard edges)" for the same reason. A
 *      1.5px border does not exist on a 2010 Apple control; it is a
 *      blurred 1px on an ordinary display.
 *
 * Both are the sort of thing that decays one careless declaration at a
 * time, which is why they are here rather than in a comment.
 */
import { readFileSync } from "node:fs";

const CSS = "src/app/globals.css";
const raw = readFileSync(CSS, "utf8");
// Blank comments, keep line numbers. Prose about a 0.5px shadow is not a
// 0.5px shadow, and this file has a lot of prose.
const css = raw.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
const lineOf = (pos: number) => css.slice(0, pos).split("\n").length;

let failed = 0;
function ok(msg: string) {
  console.log(`ok    ${msg}`);
}
function bad(msg: string) {
  failed++;
  console.log(`FAIL  ${msg}`);
}

// ---- 1. The recipe exists, in both modes ----
for (const token of ["--edge-outer", "--edge-glow", "--edge-drop"]) {
  const defs = [...css.matchAll(new RegExp(`${token}\\s*:`, "g"))].length;
  if (defs >= 2) ok(`${token} is defined for light and dark`);
  else bad(`${token} has ${defs} definition(s) - it needs a light one and a dark one, because a white ring that reads as an edge on silver reads as an outline on near-black`);
}

// The ring has to be OUTSIDE the border, which in CSS means a non-inset
// spread-only shadow. An inset one is a different layer entirely: that is
// Inner Glow, and drawing Outer as an inset is the mistake this catches.
const outer = css.match(/--edge-outer:\s*([^;]+);/);
if (outer && !/inset/.test(outer[1]) && /0 0 0 1px/.test(outer[1])) {
  ok("the outer ring is a 1px spread outside the border, not an inset");
} else {
  bad("--edge-outer must be a non-inset `0 0 0 1px` spread - inset would put it under the stroke, where it is Inner Glow and does nothing for the edge");
}

// ---- 2. Every control actually wears it ----
// Checked on the shadow declaration rather than on a class list, because
// the failure mode is a later rule overwriting box-shadow wholesale and
// dropping the ring on the floor. That is how the site lost dark mode
// once already.
const WEARERS = [".btn", ".btn-ghost", "button:not([class])"];
for (const sel of WEARERS) {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // The last rule to set box-shadow for this selector is the one that wins.
  const rules = [...css.matchAll(new RegExp(`(^|,)\\s*${esc}\\s*(,[^{}]*)?\\{([^{}]*)\\}`, "gm"))];
  const setters = rules.filter((r) => /box-shadow\s*:/.test(r[3]));
  const last = setters[setters.length - 1];
  if (!last) {
    bad(`${sel} sets no box-shadow at all, so it has no edge`);
  } else if (/var\(--edge-outer\)/.test(last[3])) {
    ok(`${sel} carries the outer ring`);
  } else {
    bad(`${sel}'s last box-shadow (line ${lineOf(last.index!)}) does not include var(--edge-outer) - a later rule has overwritten the stack and taken the ring with it`);
  }
}

// ---- 3. Integer values in every layer style ----
const FRACTION = /(-?\d+\.\d+)px/g;
type Hit = { line: number; prop: string; value: string };
const fractional: Hit[] = [];
for (const m of css.matchAll(/(box-shadow|text-shadow|--[a-z-]*shadow|--edge-[a-z]+|border(?:-(?:top|right|bottom|left))?(?:-width)?)\s*:\s*([^;]+);/g)) {
  const value = m[2];
  if (FRACTION.test(value)) {
    FRACTION.lastIndex = 0;
    fractional.push({ line: lineOf(m.index!), prop: m[1], value: value.trim().slice(0, 60) });
  }
  FRACTION.lastIndex = 0;
}
if (fractional.length === 0) {
  ok("no shadow offset or border width is a fraction of a pixel - every layer style is an integer, the way Photoshop forced them to be");
} else {
  for (const h of fractional) {
    bad(`${CSS}:${h.line} ${h.prop} has a fractional pixel - ${h.value}`);
  }
  console.log(
    "\nA half pixel does not survive the trip to a real screen: it is\n" +
      "resampled into a soft two-pixel smear, which is the exact blur the\n" +
      "1x column on page 5 of the article is there to shame. Round it."
  );
}

// ---- 4. Nothing draws chrome with a raster image ----
// "Bitmaps are your enemy because they pixelate or become blurry when
// scaled." Gradients and shapes are the CSS equivalent of the article's
// vector shape layers: sharp at any density, free at 2x.
const rasterChrome = [...css.matchAll(/(background(?:-image)?)\s*:\s*[^;]*url\((['"]?)([^)'"]+)\2\)/g)].filter(
  (m) => /\.(png|jpe?g|gif)/i.test(m[3]) && !/data:/.test(m[3])
);
if (rasterChrome.length === 0) {
  ok("no control is painted with a raster image - the chrome is all gradients and shapes, so it is already sharp at 2x");
} else {
  for (const m of rasterChrome) {
    bad(`${CSS}:${lineOf(m.index!)} paints chrome from ${m[3]} - a bitmap goes soft at 2x, which is the whole subject of the article`);
  }
}

// ---- 5. A field with no type is still a field ----
// `<input name="title" />` is a text input by definition, and it is the
// commonest shape in this codebase. Every rule that lists the types has
// to carry the default too, or those fields render flat in light mode
// and as white boxes in dark mode, which is the one thing that gives a
// dark page away.
const typeLists = [...css.matchAll(/((?:[^{}]*input\[type="[a-z-]+"\][^{}]*,\s*){2,}[^{}]*)\{/g)];
if (typeLists.length === 0) {
  bad("no rule lists input types any more - if the styling moved somewhere else this check needs to move with it");
} else {
  const missing = typeLists.filter((m) => !/input:not\(\[type\]\)/.test(m[1]));
  if (missing.length === 0) {
    ok(`all ${typeLists.length} rule(s) that list input types also match a field with no type on it`);
  } else {
    for (const m of missing) {
      bad(`${CSS}:${lineOf(m.index!)} lists input types but not \`input:not([type])\`, so every field written as <input name="..."> misses it`);
    }
  }
}

console.log(
  failed === 0
    ? "\nEight layers, whole numbers, no bitmaps. It would hold up at 2x."
    : `\n${failed} problem(s).`
);
process.exit(failed === 0 ? 0 : 1);
