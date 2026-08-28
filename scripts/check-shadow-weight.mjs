#!/usr/bin/env node
/**
 * Inline surfaces get a hairline shadow. Only floating things get a big one.
 *
 * The site read as cheap for one measurable reason: every .panel carried
 * `0 14px 28px rgba(0,0,0,0.28)` - the shadow of a modal dialog - and ten
 * of those stacked down a page is visual noise no amount of restyling
 * fixes. Copies of it had also spread to the ad slots and a widget.
 *
 * A shadow that big is correct for something genuinely floating above the
 * page: a dropdown, a popover, a modal, a FAB. It is wrong for a list
 * item. This fails the build when a large shadow lands on a selector that
 * isn't one of those.
 *
 * Run: node scripts/check-shadow-weight.mjs
 */
import { readFileSync } from "node:fs";

const CSS = "src/app/globals.css";

// Blur radius past which a shadow reads as "floating above the page".
const MAX_INLINE_BLUR = 6;

// Things that really do float. Substring match on the selector.
const FLOATERS = [
  "menu", "modal", "backdrop", "popover", "dropdown", "tooltip", "toast",
  "fab", "dialog", "overlay", "sticker", "drag", "lightbox", "picker-pop",
  // Chrome that genuinely floats above the scrolling page.
  "tabbar", "more-sheet", "app-shell", "circle-icon-btn",
  // Drawn objects rather than UI surfaces. The record and its sleeves are
  // an illustration of a stack, so they really are meant to sit on top of
  // one another; cover art and the now-playing artwork are pictures of
  // physical things, and a sleeve casting a shadow is the whole point of
  // the skeuomorphic detail rather than an accident of styling.
  "sk-stack", "sk-record", "record-",
  "sk-np-card", "sk-np-art", "track-thumb", "release-cover",
];

const raw = readFileSync(CSS, "utf8");
// Comments are blanked rather than deleted, so byte offsets - and the line
// numbers derived from them - still match the real file. Left in, a
// comment sitting above a rule gets captured as part of its selector and
// the message names the comment instead of the class.
const css = raw.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
const lineOf = (pos) => css.slice(0, pos).split("\n").length;

// Blur is the 3rd length in `offset-x offset-y blur ...`. Only flags
// outer shadows; `inset` highlights have no spread to speak of.
const SHADOW = /box-shadow\s*:\s*([^;}]+)/g;

const violations = [];
for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const [, selector, body] = rule;
  const sel = selector.toLowerCase();
  if (FLOATERS.some((f) => sel.includes(f))) continue;

  for (const m of body.matchAll(SHADOW)) {
    for (const layer of m[1].split(/,(?![^(]*\))/)) {
      if (layer.includes("inset")) continue;
      // Lengths, not just px-suffixed ones: `0 14px 28px` writes its
      // first offset unitless, so matching only /\d+px/ found two values
      // where there were three and skipped the very shadow this exists
      // to catch. Colours are stripped first so the digits inside
      // rgba(0, 0, 0, 0.28) can't be read as offsets.
      const geometry = layer
        .replace(/(?:rgba?|hsla?|color-mix)\([^)]*\)/g, " ")
        .replace(/#[0-9a-f]{3,8}/gi, " ");
      const lengths = geometry.match(/-?\d+(?:\.\d+)?(?:px|rem|em)?(?=\s|$)/g);
      if (!lengths || lengths.length < 3) continue;
      const blur = parseFloat(lengths[2]);
      if (!Number.isFinite(blur)) continue;
      if (blur > MAX_INLINE_BLUR) {
        violations.push({
          line: lineOf(rule.index + m.index),
          selector: selector.trim().split("\n").filter(Boolean).pop().slice(0, 60),
          layer: layer.trim(),
          blur,
        });
      }
    }
  }
}

if (violations.length > 0) {
  console.error(
    `Shadow weight: ${violations.length} inline surface(s) using a floating-element shadow ` +
      `(blur > ${MAX_INLINE_BLUR}px).\n`
  );
  for (const v of violations) {
    console.error(`  ${CSS}:${v.line}  ${v.selector}`);
    console.error(`    ${v.layer}  (blur ${v.blur}px)`);
  }
  console.error(
    `\nA shadow this size belongs to something floating above the page. For a panel, card ` +
      `or row, use a hairline: 0 1px 2px rgba(0,0,0,0.09). If this really does float, add its ` +
      `word to FLOATERS in ${process.argv[1].split("/").pop()}.`
  );
  process.exit(1);
}

console.log("Shadow weight OK: no inline surface is wearing a modal's shadow.");
