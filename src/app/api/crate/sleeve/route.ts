import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lookupItunesTrack } from "@/lib/itunes";

/**
 * The art and the clip for one sleeve, fetched when it is pulled out.
 *
 * A crate is thirty records and most of them are never looked at, so
 * enriching all thirty up front would be thirty lookups to show one.
 * This runs per sleeve, as somebody reaches it, plus one lookahead - so
 * the next record is ready by the time they get to it and the cost is
 * roughly what they actually dug through.
 *
 * Apple charges nothing for this and needs no key, which is why the
 * crate can afford to be this wasteful about what it does not use.
 */
export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const title = params.get("title")?.trim() ?? "";
  const artist = params.get("artist")?.trim() ?? "";
  if (!title || !artist) {
    return NextResponse.json({ error: "Nothing to look up." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const info = await lookupItunesTrack(title, artist);
    return NextResponse.json(info);
  } catch {
    // A sleeve with no art is still a sleeve. The card shows a blank
    // one rather than an error, so a lookup failing does not stop the
    // digging.
    return NextResponse.json({ artworkUrl: null, previewUrl: null, trackUrl: null });
  }
}
