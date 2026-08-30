import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendWinbacks } from "@/lib/winback";

// Point a scheduler here to send win-back nudges:
//   GET /api/winback/run
//   Authorization: Bearer $CRON_SECRET
//
// Once a day is plenty - the rules inside are measured in days, so
// running it more often just means more no-ops. Kept separate from
// /api/digest/run rather than bolted onto it: the digest reports what
// other people did to you and skips when there's nothing, and this one
// exists precisely because nothing happened.
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
  const result = await sendWinbacks(supabase);
  return NextResponse.json(result);
}
