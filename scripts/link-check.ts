/**
 * A query string never comes after a fragment.
 *
 * The Playlists tab was written as
 *
 *   href={`${feedHref("music", 1)}&view=playlists`}
 *
 * which looks fine and is not. feedHref returns a URL ending in
 * "#reviews", so what that actually produced was
 *
 *   /?type=music#reviews&view=playlists
 *
 * with view=playlists sitting INSIDE the fragment. Fragments are never
 * sent to the server, so the page read no view, decided the tab was not
 * open, and rendered the reviews feed. Clicking Playlists did nothing at
 * all, and there was nothing to see: no error, no empty state, just the
 * wrong tab's contents under the right tab's highlight.
 *
 * Nothing catches that. It type-checks, it builds, the link works, it
 * goes to a real page. So the shape is banned instead: a link may not
 * bolt query text onto the end of a URL some other function built,
 * because whether that is even legal depends on what that function
 * returned. Parameters go in through the builder, where the query is.
 *
 * Run: npx tsx scripts/link-check.ts
 */
import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join } from "node:path";

let failures = 0;
function fail(where: string, detail: string) {
  console.log(`FAIL  ${where} - ${detail}`);
  failures++;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else if (path.endsWith(".tsx") || path.endsWith(".ts")) out.push(path);
  }
  return out;
}

const files = walk("src");

// Two shapes, matched separately: a template literal keeps its own
// quotes inside ${...} - href={`${feedHref("music", 1)}&view=x`} has a
// pair of double quotes in the middle of it - so one pattern that
// stopped at any quote read that as an empty URL and passed it. Which
// is the exact link this check was written for.
const HREF_TEMPLATE = /href=\{`([^`]*)`\}/g;
const HREF_PLAIN = /href="([^"]*)"/g;

let checked = 0;
for (const file of files) {
  const src = readFileSync(file, "utf8");
  for (const m of [...src.matchAll(HREF_TEMPLATE), ...src.matchAll(HREF_PLAIN)]) {
    const url = m[1];
    checked++;

    // Query text bolted onto the end of a value this file did not build.
    // The interpolation could return anything, fragment included.
    const afterCall = url.match(/^\$\{.*?\}(.*)$/);
    if (afterCall && /[?&][\w-]+=/.test(afterCall[1])) {
      fail(
        file,
        `\`${url}\` bolts a query onto a URL built elsewhere. Pass it to the builder instead`
      );
    }

    // The same mistake written out longhand.
    const hash = url.indexOf("#");
    if (hash !== -1 && /[?&][\w-]+=/.test(url.slice(hash))) {
      fail(file, `\`${url}\` puts a query parameter after the "#", where the server never sees it`);
    }
  }
}

if (checked < 40) {
  fail("link-check", `only found ${checked} links, so it is not looking at the app any more`);
}

console.log(
  failures === 0
    ? `\nLinks OK: ${checked} checked, no query parameter hiding inside a fragment.`
    : `\n${failures} link(s) that quietly drop a parameter.`
);
process.exit(failures === 0 ? 0 : 1);
