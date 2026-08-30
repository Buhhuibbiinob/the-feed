/**
 * A missing column costs that column, never the posts.
 *
 * This has emptied the site twice - once for stickers, once when `genre`
 * shipped ahead of its migration and took every review off the feed, off
 * every profile, out of every club, out of search and out of Discover at
 * the same moment. Nothing was ever deleted either time: a select that
 * names a column the database doesn't have fails ENTIRELY, and PostgREST
 * returns data: null, which every caller renders as "there is nothing
 * here".
 *
 * Run: npx tsx scripts/post-column-check.ts
 */
import { selectPosts, withoutColumns, withoutOptionalFields } from "../src/lib/postQuery";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

const EMBED =
  "id, title, genre, profiles!posts_user_id_fkey(username, avatar_url)";

// --- the column list ---------------------------------------------------
check(
  "drops the named column",
  withoutColumns("id, title, genre", ["genre"]) === "id, title"
);
check(
  "leaves an embed intact, commas and all",
  withoutColumns(EMBED, ["genre"]) === "id, title, profiles!posts_user_id_fkey(username, avatar_url)",
  withoutColumns(EMBED, ["genre"])
);
check(
  "a column that isn't there changes nothing",
  withoutColumns("id, title", ["genre"]) === "id, title"
);

// --- the retry ---------------------------------------------------------
const MISSING = { message: 'column posts.genre does not exist' };
const ROWS = [{ id: "1", title: "Dune" }];

async function run() {
  {
    const asked: string[] = [];
    const rows = await selectPosts<{ id: string }>(
      (columns) => {
        asked.push(columns);
        return Promise.resolve(
          columns.includes("genre") ? { data: null, error: MISSING } : { data: ROWS, error: null }
        );
      },
      "id, title, genre",
      ["genre"]
    );
    check("missing column: posts still come back", rows.length === 1, `${rows.length} posts`);
    check("missing column: asked again without it", asked.length === 2 && !asked[1].includes("genre"));
  }

  {
    const asked: string[] = [];
    const rows = await selectPosts<{ id: string }>(
      (columns) => {
        asked.push(columns);
        return Promise.resolve({ data: ROWS, error: null });
      },
      "id, title, genre",
      ["genre"]
    );
    check("column present: one query, rows through", rows.length === 1 && asked.length === 1);
  }

  {
    // A real failure must not be papered over with a second attempt.
    const asked: string[] = [];
    const rows = await selectPosts<{ id: string }>(
      (columns) => {
        asked.push(columns);
        return Promise.resolve({ data: null, error: { message: "permission denied for table posts" } });
      },
      "id, title, genre",
      ["genre"]
    );
    check("other error: no rows, not retried", rows.length === 0 && asked.length === 1);
  }

  // --- the write path --------------------------------------------------
  {
    const row = { title: "Dune", body: "good", rating: 5, genre: "sci-fi" };
    const stripped = withoutOptionalFields(row);
    check("insert fallback drops only the optional field",
      !("genre" in stripped) && stripped.title === "Dune" && stripped.rating === 5);
    check("insert fallback doesn't mutate the original", row.genre === "sci-fi");
  }

  if (failures > 0) {
    console.error(`\n${failures} check${failures === 1 ? "" : "s"} failed.`);
    process.exit(1);
  }
  console.log("\nA database that is a migration behind loses a column, not the site.");
}

run();
