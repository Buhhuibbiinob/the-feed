#!/usr/bin/env node
/**
 * Themes may change colour, background and font. Nothing else.
 *
 * A theme that also sets padding, width, border-radius or the layout
 * custom properties reshapes the page instead of recolouring it, which
 * means the layout has to be re-tested against every theme and quietly
 * drifts as themes are added. This script fails the build on that.
 *
 * Run: node scripts/check-theme-purity.mjs
 */
import { readFileSync } from "node:fs";

const CSS = "src/app/globals.css";

// Properties that move, resize or restructure something.
const LAYOUT_PROPS = new Set([
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "gap", "row-gap", "column-gap",
  "width", "height", "min-width", "max-width", "min-height", "max-height",
  "display", "position", "top", "right", "bottom", "left", "inset",
  "flex", "flex-direction", "flex-wrap", "grid-template-columns", "grid-template-rows",
  "border-radius", "font-size", "line-height", "letter-spacing", "aspect-ratio",
  "align-items", "justify-content", "order", "overflow", "box-sizing",
]);

// Custom properties the layout reads. A theme changing these moves the
// furniture just as surely as setting width directly.
const LAYOUT_TOKENS = new Set([
  "--sidebar-width", "--content-direction", "--content-gap",
  "--wrap-max", "--wrap-radius", "--hero-size",
]);

const css = readFileSync(CSS, "utf8");

// Ranges inside @media, where a theme block is allowed to restate a
// responsive rule it cannot express otherwise.
const mediaRanges = [];
for (const m of css.matchAll(/@media[^{]*\{/g)) {
  let depth = 0;
  let j = m.index + m[0].length - 1;
  for (; j < css.length; j++) {
    if (css[j] === "{") depth++;
    else if (css[j] === "}" && --depth === 0) break;
  }
  mediaRanges.push([m.index, j]);
}
const inMedia = (pos) => mediaRanges.some(([a, b]) => pos >= a && pos <= b);

const lineOf = (pos) => css.slice(0, pos).split("\n").length;
const violations = [];

for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const [, selector, body] = rule;
  if (!selector.includes("[data-theme=")) continue;
  if (inMedia(rule.index)) continue;

  const stripped = body.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const decl of stripped.split(";")) {
    const prop = decl.split(":")[0]?.trim().toLowerCase();
    if (!prop) continue;
    if (LAYOUT_PROPS.has(prop) || LAYOUT_TOKENS.has(prop)) {
      violations.push({
        line: lineOf(rule.index),
        selector: selector.trim().split("\n")[0].slice(0, 70),
        prop,
      });
    }
  }
}

if (violations.length === 0) {
  console.log("Theme purity OK: no theme sets layout, spacing or sizing.");
  process.exit(0);
}

console.error(
  `\nTheme purity FAILED - ${violations.length} layout declaration(s) inside theme blocks.\n\n` +
    `Themes may set colour, background and font only. Every theme has to\n` +
    `render inside the same layout, so move these to an unscoped rule in\n` +
    `the "Shared layout" section at the end of ${CSS}.\n`
);
for (const v of violations) {
  console.error(`  ${CSS}:${v.line}  ${v.prop}  in  ${v.selector}`);
}
process.exit(1);
