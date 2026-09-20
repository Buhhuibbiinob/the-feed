import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

// Who is reading LastThread, as far as the feed is concerned.
//
// LastThread is a static site, so it cannot check a session itself. It asks
// here instead. The browser sends the feed's own session cookie with the
// request because this is the same origin, which is the whole trick: one
// account for both, and nothing for anybody to configure.
//
// Editing LastThread is an admin job, the same admin flag that guards Admin
// on the feed. No separate owners table, no second login.
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ signedIn: false, isOwner: false }, { headers: noStore });
  }

  return NextResponse.json(
    { signedIn: true, isOwner: await isAdmin(supabase, user.id), email: user.email ?? null },
    { headers: noStore }
  );
}

const noStore = { "cache-control": "no-store" };
