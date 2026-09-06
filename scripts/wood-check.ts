/**
 * The wooden shelf, and the two ways it can quietly stop being one.
 *
 * 1. THE ROW HEIGHT. The boards are painted as a repeating background on
 *    the wall, not as an element per row, because how many records fit
 *    across a shelf is decided by the viewport. That only works while the
 *    background's period and the grid's row height are the same number.
 *    Change one and every board slides out from under the records
 *    standing on it, a little further with each row down the page - and
 *    it looks fine at the top, which is where anybody would check.
 *
 * 2. THE ERA. A 1974 album standing there as a CD is the same kind of
 *    wrong as a 2015 single on a cassette. The year-to-decade conversion
 *    was originally a string slice and got this backwards for the whole
 *    of the seventies.
 */
import { readFileSync } from "node:fs";
import {
  decadeStartYear,
  decadeTagForYear,
  formatForDecadeTag,
  formatForKey,
  formatForYear,
} from "../src/lib/physicalMedia";

let failed = 0;
const ok = (m: string) => console.log(`ok    ${m}`);
const bad = (m: string) => {
  failed++;
  console.log(`FAIL  ${m}`);
};
function eq<T>(actual: T, expected: T, what: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) ok(what);
  else bad(`${what} - got ${JSON.stringify(actual)}, wanted ${JSON.stringify(expected)}`);
}

// ---- 1. The row adds up ----
const css = readFileSync("src/app/globals.css", "utf8");
function token(name: string): number | null {
  const m = css.match(new RegExp(`--${name}:\\s*(\\d+)px`));
  return m ? Number(m[1]) : null;
}
const row = token("wood-row");
const item = token("wood-item");
const board = token("wood-board");
const label = token("wood-label");
if (row === null || item === null || board === null || label === null) {
  bad("one of --wood-row, --wood-item, --wood-board or --wood-label is missing or is not a plain px value");
} else if (item + board + label < row) {
  ok(
    `the row is ${row}px and holds a ${item}px record on a ${board}px board with a ${label}px card under it, leaving ${row - item - board - label}px of air`
  );
} else {
  bad(
    `the parts of a row come to ${item + board + label}px but the row is ${row}px, so the boards and the records they hold have already drifted apart`
  );
}
// The grid must use the row token, not a number that happens to match today.
if (/grid-auto-rows:\s*var\(--wood-row\)/.test(css)) {
  ok("the grid takes its row height from the same token the boards are painted with, so the two cannot drift");
} else {
  bad("the grid's row height is not var(--wood-row) - the boards and the rows are now two numbers that have to be kept equal by hand");
}

// And the boards must be painted from those same tokens. This is the real
// invariant: as long as both sides read the same variables, changing a
// variable moves them together and nothing can slip. A literal px value
// anywhere in the board gradient breaks that, and breaks it invisibly -
// the top row still lines up, and every row after it is worse.
const boards = css.match(/repeating-linear-gradient\(\s*180deg,[^;]*--wood-back-top[^;]*\)/);
if (!boards) {
  bad("the repeating gradient that paints the boards is gone or has been rewritten past recognition");
} else {
  const literals = [...boards[0].matchAll(/(\d+)px/g)].map((m) => Number(m[1])).filter((n) => n > 8);
  const usesTokens =
    /var\(--wood-item\)/.test(boards[0]) &&
    /var\(--wood-board\)/.test(boards[0]) &&
    /var\(--wood-row\)/.test(boards[0]);
  if (usesTokens && literals.length === 0) {
    ok("the boards are painted from --wood-item, --wood-board and --wood-row, the same tokens the rows are built from, so the two move together");
  } else if (!usesTokens) {
    bad("the board gradient no longer reads --wood-item, --wood-board and --wood-row - it is now a set of numbers somebody has to keep in step with the grid by hand");
  } else {
    bad(`the board gradient has hard-coded offsets (${literals.join("px, ")}px) mixed in with the tokens, which is the same problem wearing a disguise`);
  }
}
if (/\.woodgrid\s*\{[^}]*gap:\s*0/.test(css)) {
  ok("the grid has no gap, which would put every row out of step with the board painted behind it");
} else {
  bad(".woodgrid has a gap - that space is added to each row and slides the records off their boards");
}

// ---- 2. The right object for the era ----
eq(decadeTagForYear(1978), "70s", "1978 belongs to the seventies");
eq(decadeTagForYear(1970), "70s", "so does 1970");
eq(decadeTagForYear(1989), "80s", "and 1989 to the eighties");
eq(decadeTagForYear(2005), "00s", "2005 is 00s, with the zero kept");
eq(decadeTagForYear(2010), "10s", "2010 is 10s");
eq(decadeTagForYear(null), null, "no year, no decade");

// The bug this function exists for: a slice gave "78s", which parses back
// as 1978, which is inside the cassette years.
eq(formatForDecadeTag(decadeTagForYear(1978)!), "vinyl", "a 1978 shelf is vinyl, not the cassettes a string slice produced");
eq(formatForDecadeTag("70s"), "vinyl", "the seventies are vinyl");
eq(formatForDecadeTag("80s"), "cassette", "the eighties are cassettes");
eq(formatForDecadeTag("90s"), "cd", "the nineties are CDs");
eq(formatForDecadeTag("00s"), "cd", "the two thousands are still CDs");
eq(formatForDecadeTag("10s"), "download", "the twenty tens have no object");

// Round trip, every decade the shelves offer.
for (const tag of ["70s", "80s", "90s", "00s", "10s"]) {
  const start = decadeStartYear(tag);
  if (start !== null && decadeTagForYear(start) === tag) ok(`${tag} survives the trip to a year and back`);
  else bad(`${tag} became ${start} and then ${start === null ? "null" : decadeTagForYear(start)}`);
}

// Individual years, on a shelf that is not about a decade.
eq(formatForYear(1966), "vinyl", "1966 is vinyl");
eq(formatForYear(1985), "cassette", "1985 is a cassette");
eq(formatForYear(1996), "cd", "1996 is a CD");
eq(formatForYear(2019), "download", "2019 is a file");

// ---- 3. A record does not change format between renders ----
const twice = ["abbey road", "kid a", "rumours"].map((k) => [formatForKey(k), formatForKey(k)]);
if (twice.every(([a, b]) => a === b)) ok("the same record is the same object every time, so a shelf does not flicker as it loads");
else bad("formatForKey is not stable");

// ---- 4. Every format the code can produce has somewhere to be drawn ----
const drawn = new Set([...css.matchAll(/\.fmt-([a-z]+)\b/g)].map((m) => m[1]));
for (const f of ["vinyl", "cd", "cassette", "download", "case"]) {
  if (drawn.has(f)) ok(`fmt-${f} is drawn`);
  else bad(`nothing in the stylesheet draws fmt-${f}, so those records stand on the shelf as bare squares`);
}

console.log(
  failed === 0
    ? "\nThe boards line up, and the objects belong to their decade."
    : `\n${failed} problem(s).`
);
process.exit(failed === 0 ? 0 : 1);
