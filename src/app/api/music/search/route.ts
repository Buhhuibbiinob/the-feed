import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchItunesSongs } from "@/lib/itunes";

/**
 * Song search for the pickers.
 *
 * Apple's catalogue rather than YouTube's, because YouTube's search costs
 * 100 units of a 10,000-a-day quota per request - a hundred searches for
 * the whole site, shared between four search boxes - and members were
 * hitting the rate limit mid-word. This costs nothing and needs no key.
 *
 * A YouTube video id is still what gets stored for anything that plays,
 * but that is now resolved once, when somebody picks a result, rather
 * than on every keystroke that gets through the debounce.
 */
export async function GET(request: NextRequest) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query) return NextResponse.json({ songs: [] });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    return NextResponse.json({ songs: await searchItunesSongs(query) });
  } catch {
    // The reason travels with the result, the same as the YouTube route:
    // an empty list meaning "search is down" and one meaning "no such
    // song" are different answers.
    return NextResponse.json({
      songs: [],
      error: "Couldn't reach the music catalogue. Try again in a moment.",
    });
  }
}
