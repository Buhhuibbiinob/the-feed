/**
 * The glaze.
 *
 * Gloss is the easiest thing on a site to lose by accident: it lives in
 * one background layer, nothing fails without it, and the page still
 * looks fine - just flat. These are the rules that keep it, plus the
 * three ways this pass went wrong before it went right.
 *
 * Run: npx tsx scripts/gloss-check.ts
 */
import { readFileSync } from "node:fs";

const css = readFileSync("src/app/globals.css", "utf8");
let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

const marker = "GLASS PASS";
const start = css.indexOf(marker);
check("the glass pass is still in the stylesheet", start !== -1);
if (start === -1) process.exit(1);
const block = css.slice(start, css.indexOf("The profile page as the iTunes Music Store"));

// ---- the tokens exist and are layered, not drawn ----------------------

for (const token of ["--glaze:", "--glaze-pale:", "--glaze-bar:"]) {
  check(`${token.replace(":", "")} is defined`, block.includes(token));
}
check(
  "the glaze goes on as a background layer",
  /background-image:\s*var\(--glaze\), var\(--btn-image\)/.test(block),
  "background-image, so each theme's own gradient stays underneath and no theme block needs editing"
);
check(
  "nothing draws the gloss as a separate shape",
  !/::before\s*\{[^}]*--glaze/.test(block) && !/::after\s*\{[^}]*--glaze/.test(block),
  "an earlier pass drew it as an inset pill that never lined up with the button's own corners"
);

// ---- the specular cut ---------------------------------------------------

const cut = block.match(/rgba\(255, 255, 255, 0\.14\) (\d+(?:\.\d+)?)%/);
const cutAt = cut ? Number(cut[1]) : NaN;
check(
  "the specular cut is in the top third, not the middle",
  cutAt > 0 && cutAt < 40,
  `${cutAt}% - a 46% cut put white label text on background measuring 2.1:1, which no token-based contrast check can see`
);
check(
  "the cut is hard, not blurred",
  /33\.9%[\s\S]{0,80}34%/.test(block),
  "a blurred step reads as a web gradient; the ruler-straight seam is the era's signature"
);

// ---- what must NOT be glazed -------------------------------------------

check(
  "the section label is not glazed",
  !/^\.panel-head \{/m.test(block),
  "on the default theme .panel-head is a quiet label on the linen, not a title bar - and background-image beats an earlier `background: none`"
);
for (const link of [".comment-action", ".inline-form button"]) {
  // Matched at the start of a selector, not as a substring anywhere in
  // the block. `.queue-actions .inline-form button,` contains
  // ".inline-form button," and that rule does the OPPOSITE of glazing:
  // it strips the ring and the radius off a button drawn as a link. The
  // substring test failed on it and said the link had been glazed.
  const escaped = link.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const glazed = new RegExp(`^${escaped}\\s*[,{]`, "m").test(block);
  check(
    `${link} is not glazed`,
    !glazed,
    "it is styled as a text link; a background turns it into a button, which says something different about what pressing it does"
  );
}

// ---- the counterweight -------------------------------------------------

check(
  "something on the page is sunk",
  /textarea,\s*\nselect \{[\s\S]{0,200}inset/.test(block) || /input\[type="text"\][\s\S]{0,400}inset/.test(block),
  "glass only reads as raised if the inputs are recessed against it"
);
check(
  "the card highlight is on the white body, not the wrapper",
  /\.panel-body \{[^}]*rgba\(255, 255, 255, 0\.9\) inset/.test(block) && !/^\.panel \{/m.test(block),
  "the panel's top strip is transparent on the default theme, so a highlight there floated a white hairline across the linen"
);

// ---- pressed ------------------------------------------------------------

check(
  "pressing flips the light source",
  /\.btn:active[\s\S]{0,400}linear-gradient\(\s*0deg/.test(block),
  "a dome pushed in is lit from below; flipping the glaze says 'pressed' far better than darkening it"
);

console.log(failures === 0 ? "\nIt shines, and the label is still readable." : `\n${failures} failing.`);
process.exit(failures === 0 ? 0 : 1);
