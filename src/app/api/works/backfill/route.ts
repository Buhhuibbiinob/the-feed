import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findOrCreateWork } from "@/lib/works";
import type { MediaType } from "@/lib/media";

// Gives every review posted before the works table existed a work to
// belong to:
//   GET /api/works/backfill
//   Authorization: Bearer $CRON_SECRET
//
// A one-shot, run by hand, not on a schedule - though running it twice is
// harmless, since it only touches posts with no work_id.
//
// Written in TypeScript rather than as an UPDATE in the migration on
// purpose. The identity is normalizeName/workKey in src/lib/works.ts, and
// a second implementation in SQL that disagreed with the first by one
// character - one accent, one bracket, one collapsed space - would file
// the old reviews under different works from the new ones, silently, and
// the only symptom would be two pages for the same film. One
// implementation, used by both paths.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Row = {
  id: string;
  media_type: MediaType;
  title: string;
  artist: string | null;
  cover_url: string | null;
};

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured." }, { status: 404 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Service role: this writes to every member's posts, and the update
  // policy is auth.uid() = user_id, which no admin satisfies.
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("posts")
    .select("id, media_type, title, artist, cover_url")
    .is("work_id", null)
    .limit(500)
    .returns<Row[]>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let linked = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const post of data ?? []) {
    const workId = await findOrCreateWork(
      admin,
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

    const { error: updateError } = await admin
      .from("posts")
      .update({ work_id: workId })
      .eq("id", post.id);
    if (updateError) errors.push(`${post.id}: ${updateError.message}`);
    else linked++;
  }

  // `remaining` rather than a done flag: with a limit of 500 a bigger site
  // needs a second run, and the honest answer is how many are left.
  const { count: remaining } = await admin
    .from("posts")
    .select("id", { count: "exact", head: true })
    .is("work_id", null);

  return NextResponse.json({ linked, skipped, remaining: remaining ?? 0, errors });
}
