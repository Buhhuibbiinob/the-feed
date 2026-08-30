import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendDigests } from "@/lib/digest";
import { sendWinbacks } from "@/lib/winback";

// Both mail jobs behind one scheduled URL:
//   GET /api/mail/run
//   Authorization: Bearer $CRON_SECRET
//
// They stay separate functions for the reason they were built separate -
// the digest reports what other people did to you and skips when nothing
// did, the nudge exists precisely because nothing did - but they are one
// cron entry because Vercel's Hobby plan allows two in total, and the
// third slot has to go to the bots. Combining these two rather than
// folding the bots in with them is deliberate: these are database
// queries and Resend calls, while a bot round waits on Gemini, and
// putting the slow one in the same invocation is how a scheduled job
// starts timing out.
//
// /api/digest/run and /api/winback/run still exist and still work; this
// is a door that opens both, not a replacement for either.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  // Digest first, and awaited before the nudge rather than run alongside
  // it: the nudge skips anybody the digest has reached recently, and it
  // reads digest_sent_at to know that. Run in parallel, the two jobs
  // could mail the same person twice in one minute.
  const digest = await sendDigests(supabase);
  const winback = await sendWinbacks(supabase);

  return NextResponse.json({ digest, winback });
}
