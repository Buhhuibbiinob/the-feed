import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { coverKeyFor, readTrackVideo, writeTrackVideo } from "@/lib/coverCache";
import { describeSearchFailure, searchVideosDetailed } from "@/lib/youtube";

/**
 * A record with no clip, played anyway.
 *
 * Apple has a thirty second preview for most songs and none for some,
 * and "some" is not evenly spread: it is the obscure records, which on
 * a site built around obscure records is a lot of them. What that looked
 * like was a sleeve with nothing to press - the one song somebody
 * actually wanted to hear being the one song they could not.
 *
 * YouTube has those records. The reason the whole site does not simply
 * run on YouTube is that a search costs 100 units out of 10,000 a day,
 * shared with every film trailer on Discover: a hundred searches for the
 * entire site for an entire day. Spent on shelves it would be gone in
 * one visit.
 *
 * So the rule here is strict and it is the whole design:
 *
 *  - Nothing in the background ever calls this. No shelf, no rail, no
 *    crate lookahead. It happens when a person presses play, and only
 *    then, on the one record they chose.
 *  - The answer is written down, shared by everybody. A song costs 100
 *    units once, ever, and is free from then on - so the cost is the
 *    number of DIFFERENT songs anybody has ever pressed play on with no
 *    clip, not the number of presses.
 *  - A record that already has an Apple clip never reaches here at all,
 *    because the clip plays instead.
 */
export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const title = params.get("title")?.trim() ?? "";
  const artist = params.get("artist")?.trim() ?? "";
  if (!title) return NextResponse.json({ error: "Nothing to play." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const key = coverKeyFor(title, artist);
  const remembered = await readTrackVideo(key);
  if (remembered) return NextResponse.json({ videoId: remembered });

  // A person is looking at a spinner, so this gets the part of the day's
  // allowance the shelves are not allowed to touch. See lib/youtubeBudget:
  // background work stops at seventy per cent and this does not, which is
  // the difference between a day that degrades into stale shelves and a
  // day where the play button stops working at four in the afternoon.
  const { videos, failure } = await searchVideosDetailed(
    artist ? `${artist} ${title}` : title,
    3,
    { priority: "user" }
  );
  const videoId = videos[0]?.id ?? null;
  if (!videoId) {
    return NextResponse.json({
      videoId: null,
      // Named for which thing failed. "Nothing found" and "the daily
      // allowance is spent" are different problems with different
      // answers, and telling somebody the record does not exist when the
      // truth is that the site ran out of searches is the kind of wrong
      // that makes people give up on a record that is really there.
      error: failure
        ? describeSearchFailure(failure)
        : `No video for "${title}" either. That one is hard to find.`,
    });
  }

  await writeTrackVideo(key, videoId);
  return NextResponse.json({ videoId });
}
