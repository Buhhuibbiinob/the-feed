import { isMissingSchema } from "@/lib/dbError";

// Reading posts when the database might be a migration behind.
//
// This has now emptied the site twice. A select that names a column the
// database doesn't have fails ENTIRELY - not the one column, the whole
// query - and PostgREST hands back `data: null`, which every caller
// renders as "there is nothing here". Adding `genre` to the post selects
// therefore took every review off the feed, off every profile, out of
// every club, out of search and out of Discover, all at once, with
// nothing on screen to say why. The reviews were never touched.
//
// The first time this happened it was fixed for stickers alone, in the
// one query that broke. That was too narrow a fix for a rule this
// general, so it is a shared helper now: any column that ships ahead of
// its migration goes in `optional`, and its absence costs that column
// rather than the page.

/** Splits a PostgREST select on top-level commas, leaving embeds intact. */
function splitColumns(columns: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of columns) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

/** The same select with the named columns removed. */
export function withoutColumns(columns: string, drop: string[]): string {
  return splitColumns(columns)
    .filter((part) => !drop.includes(part.trim()))
    .map((part) => part.trim())
    .join(", ");
}

type Result<T> = { data: T[] | null; error: { message: string } | null };

/**
 * Runs a post select, and if the database is missing one of the optional
 * columns, runs it again without them.
 *
 * `build` takes the column list so the caller keeps its own filters,
 * ordering and limits - this only decides which columns to ask for.
 *
 * A failure that isn't a missing column is not retried: a permissions
 * error or a timeout returns nothing, exactly as before, rather than
 * being quietly asked a second time.
 */
export async function selectPosts<T>(
  build: (columns: string) => PromiseLike<Result<T>>,
  columns: string,
  optional: string[] = OPTIONAL_POST_COLUMNS
): Promise<T[]> {
  const full = await build(columns);
  if (!full.error) return full.data ?? [];
  if (!isMissingSchema(full.error.message)) {
    console.error(`[posts] select failed: ${full.error.message}`);
    return [];
  }

  console.error(
    `[posts] database is behind on ${optional.join(", ")} - serving without. Apply supabase/migrations.`
  );
  const fallback = await build(withoutColumns(columns, optional));
  if (fallback.error) {
    console.error(`[posts] select failed even without them: ${fallback.error.message}`);
    return [];
  }
  return fallback.data ?? [];
}

/** Columns whose migration may not have been applied yet. */
export const OPTIONAL_POST_COLUMNS = ["genre"];

/**
 * Strips those columns from a row being written, for the same reason.
 *
 * An insert naming a missing column fails the same way a select does,
 * except the consequence is that nobody can post at all.
 */
export function withoutOptionalFields<T extends Record<string, unknown>>(row: T): Partial<T> {
  const copy: Record<string, unknown> = { ...row };
  for (const column of OPTIONAL_POST_COLUMNS) delete copy[column];
  return copy as Partial<T>;
}
