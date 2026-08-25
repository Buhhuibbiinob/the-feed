import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendDigests } from "@/lib/digest";

// Point a scheduler here to send activity digests:
//   GET /api/digest/run
//   Authorization: Bearer $CRON_SECRET
//
// Every few hours is the intended cadence. Members with nothing new are
// skipped entirely rather than sent an empty digest, so running it often
// costs nothing but a query.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  // Closed rather than open when unconfigured - this endpoint sends mail.
  if (!secret) {
    return NextResponse.json({ error: "Not configured." }, { status: 404 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = await createClient();
  const result = await sendDigests(supabase);
  return NextResponse.json(result);
}
