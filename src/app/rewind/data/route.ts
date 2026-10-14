import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

// Everything Rewind Theory needs to draw itself: the page as it has been
// edited, the wall, and whether the person looking may edit.
//
// Rewind Theory is the static site under public/rewind. Its edited text and
// polaroid photos are one row in site_content (readable by everyone, writable
// by admins), so editing needs no table of its own. The
// wall is the rewind_wall table, because visitors write to it.
//
// GET is public. Admins also get the posts still waiting for approval; the
// row level security policy on rewind_wall is what hides them from everyone
// else, so this route could not leak them even if it tried.
// POST is admins only, checked here and again by site_content's policy.
export const dynamic = "force-dynamic";

const KEY = "rewind";
const WALL_LIMIT = 60;
const noStore = { "cache-control": "no-store" };

type WallPost = {
  id: string;
  text: string;
  who: string | null;
  kind: "yt" | "img";
  url: string | null;
  image: string | null;
  approved: boolean;
  created_at: string;
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const owner = !!user && (await isAdmin(supabase, user.id));

  const { data: row } = await supabase.from("site_content").select("value").eq("key", KEY).maybeSingle();
  let page: unknown = null;
  if (row?.value) {
    try {
      page = JSON.parse(row.value);
    } catch {
      // A row that will not parse must not take the site down: the page
      // falls back to the text it ships with, and the next save fixes it.
      page = null;
    }
  }

  const { data: approved } = await supabase
    .from("rewind_wall")
    .select("id, text, who, kind, url, image, approved, created_at")
    .eq("approved", true)
    .order("created_at", { ascending: false })
    .limit(WALL_LIMIT);

  let pending: WallPost[] = [];
  if (owner) {
    const { data } = await supabase
      .from("rewind_wall")
      .select("id, text, who, kind, url, image, approved, created_at")
      .eq("approved", false)
      .order("created_at", { ascending: true })
      .limit(WALL_LIMIT);
    pending = (data ?? []) as WallPost[];
  }

  return NextResponse.json(
    { page, owner, wall: (approved ?? []) as WallPost[], pending },
    { headers: noStore }
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Editing Rewind Theory is for admins." }, { status: 403, headers: noStore });
  }

  let body: { page?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400, headers: noStore });
  }
  if (!body.page || typeof body.page !== "object" || Array.isArray(body.page)) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400, headers: noStore });
  }

  const value = JSON.stringify(body.page);

  // Four polaroid photos come to well under a megabyte after the page has
  // shrunk them. Anything near this is a mistake, and every visitor would
  // pay for it in download time.
  if (value.length > 3_000_000) {
    return NextResponse.json(
      { error: "The page is too big to save. Use smaller photos." },
      { status: 413, headers: noStore }
    );
  }

  const { error } = await supabase
    .from("site_content")
    .upsert({ key: KEY, value, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: noStore });
  }
  return NextResponse.json({ ok: true }, { headers: noStore });
}
