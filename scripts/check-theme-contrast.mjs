#!/usr/bin/env node
/**
 * Nav and panel text has to be readable on every theme.
 *
 * A theme is a set of colour tokens, and it is very easy to change one -
 * or to change the text colour globally, as the iOS 5 nav pass did - and
 * leave a theme rendering white on near-white without anyone noticing
 * until a member reports it.
 *
 * Two things this gets right that a quick eyeball does not:
 *  - The last declaration wins. Several themes redeclare a token in a
 *    later block, so reading the first match reports a pairing the
 *    browser never actually renders.
 *  - A gradient has several stops. Text has to survive the worst of
 *    them, not just whichever happens to be written last.
 *
 * Run: node scripts/check-theme-contrast.mjs
 */
import { readFileSync } from "node:fs";

const css = readFileSync("src/app/globals.css", "utf8");

// Pull every [data-theme="x"] { ... } block (top level, not in @media).
const blocks = {};
const re = /\[data-theme="([a-z0-9-]+)"\]([^{]*)\{([^{}]*)\}/g;
let m;
while ((m = re.exec(css))) {
  const [, theme, extra, body] = m;
  if (extra.includes("[data-mode")) continue;
  if (extra.trim() && !extra.trim().startsWith("[data-mode")) continue;
  blocks[theme] = (blocks[theme] || "") + body;
}

const rootBody = css.slice(css.indexOf(":root {") + 7, css.indexOf("}", css.indexOf(":root {")));
// Last declaration wins in CSS. Several themes redeclare a token in a
// later block, so taking the first match reports a pairing the browser
// never actually renders.
function readVar(body, name) {
  const all = [...body.matchAll(new RegExp(`${name}\\s*:\\s*([^;]+);`, "g"))];
  return all.length ? all[all.length - 1][1].trim() : null;
}

function allHex(value) {
  if (!value) return [];
  return value.match(/#[0-9a-f]{6}|#[0-9a-f]{3}/gi) ?? [];
}
function toRgb(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function lum([r, g, b]) {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const [l1, l2] = [lum(toRgb(a)), lum(toRgb(b))].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const pairs = [
  ["--nav-text", "--nav-bg", "nav"],
  ["--text", "--panel-body-bg", "panel body"],
];

const VERBOSE = process.argv.includes("--verbose");
if (VERBOSE) console.log("theme                 surface      text     bg       ratio");
const problems = [];
for (const [theme, body] of Object.entries(blocks)) {
  for (const [textVar, bgVar, label] of pairs) {
    const text = allHex(readVar(body, textVar) ?? readVar(rootBody, textVar))[0];
    // A gradient has several stops; the text has to survive the worst of
    // them, not just the one that happens to be last in the declaration.
    const stops = allHex(readVar(body, bgVar) ?? readVar(rootBody, bgVar));
    if (!text || stops.length === 0) continue;
    let worst = null;
    for (const stop of stops) {
      const r = contrast(text, stop);
      if (!worst || r < worst.ratio) worst = { stop, ratio: r };
    }
    const flag = worst.ratio < 3 ? "  <-- LOW" : worst.ratio < 4.5 ? "  <-- thin" : "";
    if (worst.ratio < 4.5) problems.push({ theme, label, text, bg: worst.stop, ratio: worst.ratio });
    if (VERBOSE) {
      console.log(
        `${theme.padEnd(20)} ${label.padEnd(12)} ${text.padEnd(8)} ${worst.stop.padEnd(8)} ${worst.ratio.toFixed(2)}${flag}`
      );
    }
  }
}
// Below 3.0 is unreadable and fails the build. Between 3.0 and 4.5 is
// thin for text this size but is a design call on themes that already
// shipped, so it warns instead.
const failures = problems.filter((p) => p.ratio < 3);
const thin = problems.filter((p) => p.ratio >= 3);

for (const p of thin) {
  console.warn(
    `Thin: ${p.theme} ${p.label} - ${p.text} on ${p.bg} is ${p.ratio.toFixed(2)}:1`
  );
}

if (failures.length === 0) {
  console.log(`Theme contrast OK${thin.length ? ` (${thin.length} thin, none unreadable)` : ""}.`);
  process.exit(0);
}

console.error("\nTheme contrast FAILED - text is unreadable on these:\n");
for (const p of failures) {
  console.error(`  ${p.theme} ${p.label}: ${p.text} on ${p.bg} = ${p.ratio.toFixed(2)}:1`);
}
console.error("\nPick a text colour that survives every stop of the background gradient.");
process.exit(1);
