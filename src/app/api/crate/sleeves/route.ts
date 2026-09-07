import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lookupItunesTrack, type ItunesTrackInfo } from "@/lib/itunes";

/**
 * Art, clips and release years for a handful of sleeves at once.
 *
 * The single sleeve route is right for the crate, where somebody is
 * looking at one record and the next one is a guess. It was badly wrong
 * for a shelf. A shelf of fifty asked for them one at a time, two in
 * flight, with a hundred and sixty millisecond wait between each pair -
 * so twenty five rounds of (sign the request, check the session, route
 * it, ask Apple, wait). Covers appeared over the course of a minute, in
 * dribs, which is exactly what got reported: everything takes far too
 * long to load.
 *
 * Almost none of that minute was Apple. It was the twenty five round
 * trips and the fifty session checks around them. So: one request, one
 * session check, the lookups run together on the server, one answer.
 *
 * The cap is not politeness, it is the point. Apple allows roughly
 * twenty calls a minute and answers 403 above that, so a batch of two
 * hundred would throttle itself and come back empty. The caller asks for
 * what somebody can actually see; a screenful is well inside the limit,
 * and lib/itunes caches for an hour on top of that, so scrolling back up
 * costs nothing.
 */
const MAX_ITEMS = 24;

/** How many of a batch are in flight at once. */
const CONCURRENCY = 6;

type Ask = { key: string; title: string; artist: string };

function asks(value: unknown): Ask[] {
  if (!Array.isArray(value)) return [];
  const out: Ask[] = [];
  for (const raw of value.slice(0, MAX_ITEMS)) {
    if (!raw || typeof raw !== "object") continue;
    const { key, title, artist } = raw as Record<string, unknown>;
    if (typeof key !== "string" || typeof title !== "string" || typeof artist !== "string") continue;
    const t = title.trim();
    const a = artist.trim();
    if (!t || !a) continue;
    out.push({ key, title: t, artist: a });
  }
  return out;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nothing to look up." }, { status: 400 });
  }
  const items = asks((body as { items?: unknown })?.items);
  if (items.length === 0) return NextResponse.json({ results: {} });

  const results: Record<string, ItunesTrackInfo> = {};
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const ask = items[cursor++];
      // A sleeve that fails is a sleeve with no art, not a failed batch.
      // One bad lookup must not cost the other twenty three their covers.
      const info = await lookupItunesTrack(ask.title, ask.artist).catch(() => null);
      if (info) results[ask.key] = info;
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));

  return NextResponse.json({ results });
}
