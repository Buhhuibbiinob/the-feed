import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { describeSearchFailure, searchVideosDetailed } from "@/lib/youtube";

/**
 * The one YouTube call a song needs.
 *
 * Everything that plays on this site plays through a YouTube embed, so a
 * chosen song still has to become a video id. That used to happen as a
 * side effect of searching: every query that got through the debounce
 * spent 100 quota units, and the id came from whichever result was
 * clicked.
 *
 * Now the browsing happens against Apple's catalogue and this runs once,
 * on the result somebody actually picked - roughly one request per song
 * added instead of one per pause in their typing.
 *
 * Asks for three results rather than one: the top hit for "Artist Title"
 * is occasionally a reaction video or a lyric-video upload of something
 * else, and having a couple to fall back on costs the same 100 units as
 * having one.
 */
export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const title = params.get("title")?.trim() ?? "";
  const artist = params.get("artist")?.trim() ?? "";
  if (!title) return NextResponse.json({ error: "Nothing to look up." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { videos, failure } = await searchVideosDetailed(
    artist ? `${artist} ${title}` : title,
    3
  );

  return NextResponse.json({
    videos,
    ...(failure ? { error: describeSearchFailure(failure) } : {}),
  });
}
