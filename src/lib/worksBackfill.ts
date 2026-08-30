import type { SupabaseClient } from "@supabase/supabase-js";
import { findOrCreateWork } from "@/lib/works";
import type { MediaType } from "@/lib/media";

// Giving the reviews posted before the works table existed a work to
// belong to.
//
// The job itself lives here rather than in the route, because there are
// two ways to ask for it - the scheduled endpoint and a button on the
// admin page - and two copies of a backfill is how you end up with one
// that was fixed and one that wasn't.
//
// Written in TypeScript rather than as an UPDATE in the migration on
// purpose. The identity is workKey() in lib/works.ts, and a second
// implementation in SQL that disagreed by one character - one accent, one
// bracket, one collapsed space - would file the old reviews under
// different works from the new ones, silently, and the only symptom would
// be two pages for the same film.

export type BackfillResult = {
  linked: number;
  /** Titles that normalise to nothing, so there is no work to make. */
  skipped: number;
  remaining: number;
  errors: string[];
};

type Row = {
  id: string;
  media_type: MediaType;
  title: string;
  artist: string | null;
  cover_url: string | null;
};

/**
 * Links up to `limit` unlinked reviews, and reports how many are left.
 *
 * Safe to run repeatedly: it only ever looks at posts with no work_id, so
 * a second run is a no-op once the first has finished the job.
 */
export async function backfillWorks(
  client: SupabaseClient,
  { limit = 500 }: { limit?: number } = {}
): Promise<BackfillResult> {
  const { data, error } = await client
    .from("posts")
    .select("id, media_type, title, artist, cover_url")
    .is("work_id", null)
    .limit(limit)
    .returns<Row[]>();

  if (error) return { linked: 0, skipped: 0, remaining: 0, errors: [error.message] };

  let linked = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const post of data ?? []) {
    const workId = await findOrCreateWork(
      client,
      post.media_type,
      post.title,
      post.artist,
      post.cover_url
    );
    // A title that normalises to nothing - punctuation, an empty string -
    // has no work, and inventing one called "" would be worse than
    // leaving the review unlinked.
    if (!workId) {
      skipped++;
      continue;
    }

    const { error: updateError } = await client
      .from("posts")
      .update({ work_id: workId })
      .eq("id", post.id);
    if (updateError) errors.push(`${post.id}: ${updateError.message}`);
    else linked++;
  }

  // `remaining` rather than a done flag: a bigger site needs a second run,
  // and the honest answer is how many are left.
  const { count: remaining } = await client
    .from("posts")
    .select("id", { count: "exact", head: true })
    .is("work_id", null);

  return { linked, skipped, remaining: remaining ?? 0, errors };
}
