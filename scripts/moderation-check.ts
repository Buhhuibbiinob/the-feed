/**
 * Admin controls follow the admin.
 *
 * Edit and Delete on someone else's review are gated on one prop. A page
 * that renders PostCard and forgets to pass it doesn't fail, doesn't warn,
 * and doesn't look broken - the buttons are simply not there, which reads
 * as "admins can't do that" rather than "this page forgot".
 *
 * Five of the eight pages that render a review had forgotten. So the prop
 * is checked rather than remembered.
 *
 * Run: npx tsx scripts/moderation-check.ts
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith(".tsx") ? [path] : [];
  });
}

const files = walk("src/app");
const renderers = files.filter((f) => readFileSync(f, "utf8").includes("<PostCard"));
check("there are review pages to check", renderers.length > 0, `${renderers.length} found`);

const missing = renderers.filter((f) => !readFileSync(f, "utf8").includes("viewerIsAdmin="));
check(
  "every page that shows a review passes viewerIsAdmin",
  missing.length === 0,
  missing.length ? `no admin controls on: ${missing.join(", ")}` : `${renderers.length} pages`
);

// The prop is only worth passing if the card still acts on it, and the
// server actions are only safe if they still check for themselves - the
// prop hides a button, it does not authorise anything.
const card = readFileSync("src/components/PostCard.tsx", "utf8");
check(
  "the card still opens edit and delete to an admin",
  /canEdit\s*=\s*isOwner \|\| viewerIsAdmin/.test(card) &&
    /canDelete\s*=\s*isOwner \|\| viewerIsAdmin/.test(card)
);

const posts = readFileSync("src/app/actions/posts.ts", "utf8");
check(
  "the server still decides who may delete, not the button",
  posts.includes("isAdmin(supabase, user.id)") && posts.includes("createAdminClient()")
);

console.log(
  failures === 0 ? "\nAn admin can moderate a review wherever they find it." : `\n${failures} failing.`
);
process.exit(failures === 0 ? 0 : 1);
