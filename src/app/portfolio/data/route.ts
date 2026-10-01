import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

// Everything the portfolio has been edited into, as one JSON document.
//
// It is one row in site_content, like LastThread: readable by everyone,
// writable by admins only (checked here, and again by the table's row
// level security). Pictures are not in here, only their addresses: the
// files themselves go to storage through ./upload, so this stays small.
//
// The page sends the whole document on every save. There is one editor,
// so last write wins is the right rule and there is nothing to merge.
export const dynamic = "force-dynamic";

const KEY = "portfolio";
const noStore = { "cache-control": "no-store" };
const MAX_CHARS = 500_000;

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.from("site_content").select("value").eq("key", KEY).maybeSingle();
  let doc: unknown = null;
  if (data?.value) {
    try {
      doc = JSON.parse(data.value);
    } catch {
      // A row that will not parse must not take the site down: the page
      // falls back to its built-in starting content.
      doc = null;
    }
  }
  return NextResponse.json({ doc }, { headers: noStore });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Only the owner can edit this portfolio." }, { status: 403, headers: noStore });
  }

  let body: { doc?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400, headers: noStore });
  }

  const doc = body.doc;
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return NextResponse.json({ error: "Bad document." }, { status: 400, headers: noStore });
  }

  const value = JSON.stringify(doc);
  if (value.length > MAX_CHARS) {
    return NextResponse.json(
      { error: "That is more writing than the portfolio can hold. Shorten something and try again." },
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
