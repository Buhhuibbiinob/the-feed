import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { backfillWorks } from "@/lib/worksBackfill";

// Gives every review posted before the works table existed a work to
// belong to:
//   GET /api/works/backfill
//   Authorization: Bearer $CRON_SECRET
//
// A one-shot run by hand, not a schedule - though running it twice is
// harmless, since it only touches posts with no work_id. There is a
// button for the same job on the admin page, which is the way anybody
// who isn't holding a bearer token will actually run it; the work itself
// lives in lib/worksBackfill.ts so the two cannot drift.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Not configured." }, { status: 404 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Service role: this writes to every member's posts, and the update
  // policy is auth.uid() = user_id, which no admin satisfies.
  return NextResponse.json(await backfillWorks(createAdminClient()));
}
