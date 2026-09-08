import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lookupTrack } from "@/lib/catalogue";
import { coverKeyFor, readCovers, worthRemembering, writeCovers } from "@/lib/coverCache";

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
    // The database first. A record somebody has already dug up is
    // answered without touching Apple, which matters most here: the
    // crate and the shelves share one small budget with the search box,
    // and the same records surface in all three.
    const cacheKey = coverKeyFor(title, artist);
    const known = await readCovers([cacheKey]);
    const remembered = known.get(cacheKey);
    if (remembered) return NextResponse.json(remembered);

    // Both catalogues. Somebody is holding this one record and waiting,
    // so it is worth asking the second one when the first has nothing.
    const info = await lookupTrack(title, artist);
    // A refusal travels as a refusal.
    //
    // Apple answers 403 when asked too often and lookupItunesTrack hands
    // back the same all-nulls shape for that as for "no such track".
    // Passed on, the crate wrote it down as "this record has no cover"
    // and marked the record looked-up, so one busy moment left a blank
    // sleeve there for good. The batch route learned this already; this
    // one is where the crate actually gets its covers from.
    if (info.throttled) {
      return NextResponse.json({ throttled: true }, { status: 503 });
    }
    // Deep, because this route always uses the catalogue fallback - so
    // an empty answer from here really is "Apple does not have it", and
    // is worth writing down so nobody pays for that lookup again.
    if (worthRemembering(info, true)) await writeCovers([{ key: cacheKey, info }]);
    return NextResponse.json(info);
  } catch {
    // A sleeve with no art is still a sleeve. The card shows a blank
    // one rather than an error, so a lookup failing does not stop the
    // digging.
    return NextResponse.json({ artworkUrl: null, previewUrl: null, trackUrl: null });
  }
}
