import { NextResponse, type NextRequest } from "next/server";
import { runBotRound } from "@/app/actions/bots";

// Lets a scheduler run a round of bot activity, so the feed keeps a pulse
// during the hours nobody is posting. The bot engine itself already
// existed and is admin-triggered; this is only the door a cron can knock
// on. It stays off entirely unless two things are true: the bots_enabled
// flag is on (checked inside runBotRound), and CRON_SECRET is configured.
//
// Point a scheduler at:  GET /api/bots/run
//   Authorization: Bearer $CRON_SECRET
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  // No secret configured means the endpoint is closed, not open. An
  // unauthenticated route that writes AI posts into a public feed is not
  // something to leave on by default.
  if (!secret) {
    return NextResponse.json({ error: "Not configured." }, { status: 404 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await runBotRound();
  // Always 200: a round where nothing happened (no active bots, an
  // upstream API down) is a normal outcome, and a scheduler that retries
  // on it would hammer the feed. The body carries what actually happened.
  return NextResponse.json(result);
}
