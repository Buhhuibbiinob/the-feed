/**
 * Dark mode has to beat the theme.
 *
 * A theme is a look somebody chose; dark mode is a condition they are
 * reading in. So when both have an opinion about the same colour, the
 * mode wins - and for a long time it did not.
 *
 * `[data-mode="dark"] .seg` and `[data-theme="ios-light"] .seg` have
 * identical specificity, so whichever is written later wins. The theme
 * blocks are written later. Sixteen dark-mode rules were silently
 * losing, including .panel's background, border and shadow - which is
 * why dark mode barely did anything on the default theme.
 *
 * Prefixing the mode selectors with :root lifts them one level, so the
 * fix is structural rather than a matter of who is further down the
 * file. This checks it stays that way.
 *
 * Run: npx tsx scripts/dark-mode-check.ts
 */
import { readFileSync } from "node:fs";

const raw = readFileSync("src/app/globals.css", "utf8");
// Comments blanked, not removed, so offsets still line up with the file.
const css = raw.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

type Rule = { at: number; selector: string; body: string };
const rules: Rule[] = [];
for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const head = m[1].trim();
  if (!head || head.startsWith("@")) continue;
  for (const part of head.split(",")) {
    const selector = part.trim();
    if (selector) rules.push({ at: m.index, selector, body: m[2] });
  }
}

/** Classes, attributes and pseudo-classes - the middle specificity column. */
function weight(selector: string): number {
  return (
    (selector.match(/\.[\w-]+/g) ?? []).length +
    (selector.match(/\[[^\]]+\]/g) ?? []).length +
    (selector.match(/:(?!:)[\w-]+/g) ?? []).length
  );
}

/** The selector with its mode/theme prefix taken off, so the two can be
 *  compared as opinions about the same element. */
function target(selector: string): string {
  return selector
    .replace(/^\s*:root\s*/, "")
    .replace(/^\s*\[data-mode="dark"\]\s*/, "")
    .replace(/^\s*\[data-theme="[^"]+"\]\s*/, "")
    .trim();
}

function properties(body: string): Set<string> {
  return new Set(
    body
      .split(";")
      .filter((d) => d.includes(":"))
      .map((d) => d.split(":")[0].trim())
  );
}

const darkRules = rules.filter((r) => /\[data-mode="dark"\]/.test(r.selector));
// Rules that are a theme's opinion about colour WITHOUT knowing about
// the mode. A selector carrying both - [data-theme="x"][data-mode="dark"]
// - is a theme's dark variant, which is mode-aware by construction and
// is not competing with anything.
const themeRules = rules.filter(
  (r) => r.selector.trimStart().startsWith("[data-theme=") && !/\[data-mode=/.test(r.selector)
);

check("there are dark-mode rules to protect", darkRules.length > 0, `${darkRules.length} found`);
// A rule that leads with the mode attribute and nothing else is the one
// that ties with a theme. One that already leads with a theme is
// specific enough on its own.
const bareMode = darkRules.filter((r) => r.selector.trimStart().startsWith("[data-mode="));
check(
  "no dark-mode rule leads with the bare attribute",
  bareMode.length === 0,
  bareMode.map((r) => r.selector).slice(0, 5).join(" | ") ||
    ":root lifts them above a theme's equal-specificity claim"
);

// The real test: for each dark rule, is there a theme rule about the
// same element, setting the same property, that would win?
const losing: string[] = [];
for (const dark of darkRules) {
  const key = target(dark.selector);
  const props = properties(dark.body);
  const dw = weight(dark.selector);
  for (const theme of themeRules) {
    if (target(theme.selector) !== key) continue;
    const clash = [...props].filter((p) => properties(theme.body).has(p));
    if (clash.length === 0) continue;
    const tw = weight(theme.selector);
    // A theme wins on higher specificity, or on equal specificity if it
    // comes later in the file.
    if (tw > dw || (tw === dw && theme.at > dark.at)) {
      losing.push(`${dark.selector} loses to ${theme.selector} over ${clash.join(", ")}`);
      break;
    }
  }
}
check(
  "no dark-mode rule loses to a theme",
  losing.length === 0,
  losing.slice(0, 6).join("\n        ") || `${darkRules.length} rules checked`
);

console.log(
  failures === 0 ? "\nDark mode wins over the theme, on every theme." : `\n${failures} failing.`
);
process.exit(failures === 0 ? 0 : 1);
