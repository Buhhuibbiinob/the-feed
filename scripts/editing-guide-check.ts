/**
 * The map still describes the territory.
 *
 * EDITING.md exists so somebody can open a file, change one line and
 * know what happens. A guide that names a constant which has been
 * renamed, or points at a file that has moved, is worse than no guide:
 * it costs the reader the time to find out it is lying, and it teaches
 * them not to trust the rest of it.
 *
 * Line numbers are allowed to drift - they are written as "~529" and the
 * guide says to search for the name. The NAMES are not allowed to drift,
 * so those are what this checks.
 */
import { existsSync, readFileSync } from "node:fs";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

const guide = readFileSync("EDITING.md", "utf8");

// Every file the guide names, in a table or a code fence, has to exist.
const paths = [...guide.matchAll(/(?:^|[\s`(])((?:src|scripts|supabase)\/[A-Za-z0-9_\-[\]./]*)/gm)]
  .map((m) => m[1].replace(/[.,`)]+$/, ""))
  .filter((p) => /\.[a-z]+$/.test(p));
const missing = [...new Set(paths)].filter((p) => !existsSync(p));
check("every file the guide names exists", missing.length === 0, missing.join(" | "));

// Every constant it tells you to edit has to still be called that.
const named: [string, string][] = [
  ["src/lib/lastfm.ts", "SCENE_ROSTER"],
  ["src/lib/lastfm.ts", "ROSTER_UNPLACED"],
  ["src/lib/lastfm.ts", "TAG_TEXT"],
  ["src/lib/shelves.ts", "SHELF_SIZE"],
  ["src/lib/shelfAxes.ts", "FIRST_YEAR"],
  ["src/lib/shelves.ts", "SHELF_SPARE"],
  ["src/lib/shelves.ts", "ROSTER_SHARE"],
  ["src/lib/shelves.ts", "HIT_CEILING"],
  ["src/lib/shelves.ts", "ARTISTS_CHECKED"],
  ["src/lib/shelves.ts", "STILL_UNKNOWN"],
  ["src/lib/youtubeBudget.ts", "DAILY_UNITS"],
  ["src/lib/youtubeBudget.ts", "BACKGROUND_SHARE"],
];
for (const [file, constant] of named) {
  const src = existsSync(file) ? readFileSync(file, "utf8") : "";
  check(
    `${constant} is still called that in ${file.split("/").pop()}`,
    new RegExp(`\\b${constant}\\b`).test(src) && guide.includes(constant)
  );
}

// The two-per-artist rule is quoted in the guide as something to search
// for, so the thing it tells you to search for has to be findable.
const shelves = readFileSync("src/lib/shelves.ts", "utf8");
check("the phrase the guide says to search for is findable", /taken >= 2/.test(shelves));

// And the commands it tells you to run have to exist.
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
  scripts?: Record<string, string>;
};
for (const script of ["dev", "lint", "build"]) {
  check(`npm run ${script} exists`, Boolean(pkg.scripts?.[script]));
}

console.log(
  failures === 0 ? "\nThe map matches the territory." : `\n${failures} stale in EDITING.md.`
);
process.exit(failures === 0 ? 0 : 1);
