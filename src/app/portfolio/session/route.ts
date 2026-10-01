import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

// Who is looking at the portfolio, as far as the feed is concerned.
//
// The portfolio is a static site under public/portfolio, the same way
// LastThread is, so it asks here rather than checking a session itself.
// Same origin, so the feed's own session cookie comes along: sign in on
// the feed and you are signed in here. Editing is the admin flag.
export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" };

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ signedIn: false, isOwner: false }, { headers: noStore });
  }

  return NextResponse.json(
    { signedIn: true, isOwner: await isAdmin(supabase, user.id) },
    { headers: noStore }
  );
}
