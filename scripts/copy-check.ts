/**
 * No dashes in anything a person reads.
 *
 * House style, and stricter than it sounds: not just the em dash, but the
 * en dash, the hyphen used as punctuation, and the little " - " that
 * creeps in as a separator between two values. A dash is almost always
 * standing in for a decision somebody did not make - a comma, a colon or
 * a full stop, each of which says something more specific about how the
 * two halves relate. Writing without them is most of what makes copy
 * sound like a person rather than like a product.
 *
 * Hyphens INSIDE a word are fine and always were: top-rated, year-in-
 * review, sci-fi. The rule is about a dash with air on both sides.
 *
 * Two things are deliberately out of scope. Comments are for whoever is
 * reading the code and are not copy. And a regex that MATCHES a dash is
 * parsing text other people wrote - YouTube titles and Last.fm artist
 * names are full of them - so those have to keep working.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const UNICODE_DASHES = /[‒–—―−]/;
/** A hyphen with a space on both sides: punctuation, not a compound word. */
const SPACED_HYPHEN = / - /;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (path.endsWith(".tsx") || path.endsWith(".ts")) out.push(path);
  }
  return out;
}

/** Blank out comments, keeping line numbers, so prose about a dash is not a dash. */
function withoutComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "));
  return noBlocks
    .split("\n")
    .map((line) => {
      const at = line.indexOf("//");
      if (at < 0) return line;
      // Only a real comment if the slashes are not inside a string.
      const before = line.slice(0, at);
      const quoted = (before.match(/"/g) ?? []).length % 2 === 1 ||
        (before.match(/'/g) ?? []).length % 2 === 1 ||
        (before.match(/`/g) ?? []).length % 2 === 1;
      return quoted ? line : before;
    })
    .join("\n");
}

/** A line that is parsing somebody else's text rather than writing ours. */
function isRegex(line: string): boolean {
  return (
    /\.(replace|match|split|test|exec)\s*\(\s*\//.test(line) ||
    /^\s*const \w+ = \/.*\/[gimsuy]*;/.test(line)
  );
}

/**
 * The pieces of a line a person will actually read.
 *
 * Checking whole lines was the first attempt and it does not work: a line
 * of arithmetic is full of dashes, so it needed a filter for those, and
 * the filter could not tell `width - offset` from "Nothing here yet - be
 * the first", which is the same three tokens. It quietly let the second
 * one through.
 *
 * Reading the strings and the JSX text out of the line instead makes the
 * question go away, because arithmetic is never inside either. Template
 * holes are dropped first, since `${a - b}` is code that happens to be
 * living in a string.
 */
function readableParts(line: string): string[] {
  const parts: string[] = [];
  const withoutHoles = line.replace(/\$\{[^}]*\}/g, "");
  for (const m of withoutHoles.matchAll(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g)) {
    parts.push(m[0]);
  }
  // JSX text: what sits between two tags, with no braces or quotes in it.
  //
  // The lookarounds are not decoration. Without them this matches inside
  // `(t) => t - editAt <= GAP`, because the > of the arrow and the < of
  // the comparison look exactly like a pair of tags with prose between
  // them. An earlier pass used this same expression to REWRITE copy and
  // duly turned that line into `t: editAt`, which is how a punctuation
  // sweep breaks a build.
  for (const m of withoutHoles.matchAll(/(?<![=!<>+\-*/&|])>([^<>{}"'`]+)<(?![=])/g)) {
    parts.push(m[1]);
  }
  // And a bare run of prose on its own line inside JSX, which has neither
  // a tag nor a quote on it. The test has to exclude every scrap of code
  // punctuation, not just the brackets: `cursor.setUTCDate(x - 1);` has
  // no angle bracket or quote in it either, and read as a sentence it is
  // a hyphen with air on both sides.
  if (!/[<>{}"'`=()[\];:/\\+*&|]/.test(withoutHoles) && /[a-zA-Z]{3}\s+[a-zA-Z]/.test(withoutHoles)) {
    parts.push(withoutHoles);
  }
  return parts;
}

const problems: string[] = [];
for (const file of walk("src")) {
  const lines = withoutComments(readFileSync(file, "utf8")).split("\n");
  lines.forEach((line, i) => {
    if (isRegex(line)) return;
    for (const part of readableParts(line)) {
      if (UNICODE_DASHES.test(part)) {
        problems.push(`${file}:${i + 1} has a unicode dash in copy: ${part.trim().slice(0, 80)}`);
        break;
      }
      if (SPACED_HYPHEN.test(part)) {
        problems.push(`${file}:${i + 1} uses a hyphen as punctuation: ${part.trim().slice(0, 80)}`);
        break;
      }
    }
  });
}

if (problems.length === 0) {
  console.log("ok    no dash is doing a comma's job anywhere a person can read it");
  console.log("\nCopy reads like somebody wrote it.");
} else {
  for (const p of problems) console.log(`FAIL  ${p}`);
  console.log(
    `\n${problems.length} dash(es) in copy. A comma joins two halves of one thought, a colon` +
      "\nintroduces what follows, and a full stop admits there were two sentences.\nPick whichever one is true."
  );
}
process.exit(problems.length === 0 ? 0 : 1);
