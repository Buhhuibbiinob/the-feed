/**
 * Which pages are hidden, and whether "off by default" actually works.
 *
 * Direct messages are off unless somebody turns them on, which inverts
 * the rule the rest of the site runs on. That inversion is easy to get
 * backwards in a way nothing would report: a page that quietly stays
 * visible after being archived, or one that can never be switched back
 * on because the default keeps winning.
 *
 * Run: npx tsx scripts/archived-pages-check.ts
 */
import { BUILTIN_PAGES, DEFAULT_ARCHIVED_SLUGS } from "../src/lib/builtinPages";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

/** The resolver from lib/pages, without a database in the way. */
function archivedFor(rows: { slug: string; archived: boolean }[]): Set<string> {
  const explicit = new Map(rows.map((r) => [r.slug, r.archived]));
  const archived = new Set<string>();
  for (const page of BUILTIN_PAGES) {
    const row = explicit.get(page.slug);
    if (row === undefined ? DEFAULT_ARCHIVED_SLUGS.has(page.slug) : row) archived.add(page.slug);
  }
  return archived;
}

check(
  "every default-archived slug is a real page",
  [...DEFAULT_ARCHIVED_SLUGS].every((s) => BUILTIN_PAGES.some((p) => p.slug === s)),
  [...DEFAULT_ARCHIVED_SLUGS].filter((s) => !BUILTIN_PAGES.some((p) => p.slug === s)).join(", ")
);

// A fresh site, no rows at all.
const fresh = archivedFor([]);
check("with no rows, messages is hidden", fresh.has("messages"));
check("with no rows, nothing else is hidden", [...fresh].join(",") === "messages", [...fresh].join(", "));

// The admin turns it back on. This is the one that matters: an explicit
// row has to beat the default, or the toggle is decorative.
check(
  "an explicit archived=false turns messages back on",
  !archivedFor([{ slug: "messages", archived: false }]).has("messages")
);
check(
  "an explicit archived=true keeps it off",
  archivedFor([{ slug: "messages", archived: true }]).has("messages")
);

// The ordinary pages still behave the ordinary way round.
check("a normal page is visible with no row", !archivedFor([]).has("chat"));
check("a normal page hides when archived", archivedFor([{ slug: "chat", archived: true }]).has("chat"));
check(
  "archiving one page does not archive another",
  !archivedFor([{ slug: "chat", archived: true }]).has("weekly")
);

if (failures > 0) {
  console.error(`\n${failures} check${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
console.log("\nMessages is off, and one toggle brings it back.");
