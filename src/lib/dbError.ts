/**
 * Turns a Postgres/PostgREST error into something a member can read.
 *
 * The schema lives in supabase/schema.sql and is applied by hand, so a
 * feature can ship in the app before its table exists in the database.
 * When that happened the raw driver string went straight to the screen:
 *
 *   Could not find the table 'public.weekly_answers' in the schema cache
 *
 * That tells a member nothing they can act on, and it tells whoever runs
 * the site the wrong thing - it reads like the feature is broken rather
 * than like one SQL file has not been run.
 */

const MISSING_TABLE = /Could not find the table|relation .* does not exist|schema cache/i;
const MISSING_COLUMN = /Could not find the .* column|column .* does not exist/i;

export function friendlyDbError(message: string | null | undefined): string {
  if (!message) return "Something went wrong. Try again.";
  if (MISSING_TABLE.test(message) || MISSING_COLUMN.test(message)) {
    return "This feature isn't switched on yet - the database is missing a table it needs. Whoever runs the site needs to apply supabase/migrations.";
  }
  return message;
}

/** True when the failure is "the schema has not been applied", not a bug. */
export function isMissingSchema(message: string | null | undefined): boolean {
  return !!message && (MISSING_TABLE.test(message) || MISSING_COLUMN.test(message));
}
