import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";

// The "what do you miss?" wall on Rewind Theory.
//
// POST is open to anybody, signed in or not: that is the point of the wall.
// What protects the site is that a visitor's post goes in unapproved and
// stays invisible until an admin approves it. The rewind_wall policies
// enforce that in the database; the checks here are for a clear error
// message, not for safety.
//
// PATCH (approve) and DELETE are admins only, here and in the policies.
export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" };

// Past this many posts waiting, new ones are refused until some are dealt
// with. Without it one script could fill the database overnight.
const PENDING_CAP = 300;

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

/** A canonical watch URL for anything YouTube hands out, or null. */
function youtubeUrl(raw: string): string | null {
  let s = raw.trim();
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  let id: string | null = null;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
    if (host === "youtu.be") id = u.pathname.slice(1);
    else if (host === "youtube.com") {
      id = u.searchParams.get("v");
      if (!id) id = /^\/(?:shorts|embed|live)\/([^/?#]+)/.exec(u.pathname)?.[1] ?? null;
    }
  } catch {
    return null;
  }
  return id && /^[\w-]{6,20}$/.test(id) ? `https://www.youtube.com/watch?v=${id}` : null;
}

export async function POST(request: NextRequest) {
  let body: { text?: unknown; who?: unknown; url?: unknown; image?: unknown; website?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail("Bad request.");
  }

  // A field people never see. A person leaves it empty; a form-filling bot
  // does not. Say thanks either way so the bot learns nothing.
  if (typeof body.website === "string" && body.website !== "") {
    return NextResponse.json({ ok: true, approved: false }, { headers: noStore });
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const who = typeof body.who === "string" ? body.who.trim().slice(0, 40) : "";
  if (!text) return fail("Say what you miss first.");
  if (text.length > 120) return fail("Keep it under 120 characters.");

  let kind: "yt" | "img";
  let url: string | null = null;
  let image: string | null = null;
  if (typeof body.url === "string" && body.url.trim()) {
    url = youtubeUrl(body.url);
    if (!url) return fail("That doesn't look like a YouTube link. Copy it from the Share button on YouTube.");
    kind = "yt";
  } else if (typeof body.image === "string" && body.image) {
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(body.image)) {
      return fail("That picture didn't come through. Try a JPG or PNG.");
    }
    if (body.image.length > 250_000) return fail("That picture is too big. Try a smaller one.");
    image = body.image;
    kind = "img";
  } else {
    return fail("Add a YouTube link or a picture.");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const owner = !!user && (await isAdmin(supabase, user.id));

  if (!owner) {
    // Counting rows a visitor cannot see needs the service key. If it is not
    // configured the cap is skipped rather than the wall being closed.
    try {
      const admin = createAdminClient();
      const { count } = await admin
        .from("rewind_wall")
        .select("id", { count: "exact", head: true })
        .eq("approved", false);
      if ((count ?? 0) >= PENDING_CAP) {
        return fail("The wall has a lot waiting to be looked at. Try again in a few days.", 429);
      }
    } catch {
      /* no service key: no cap */
    }
  }

  const { error } = await supabase.from("rewind_wall").insert({
    text,
    who: who || null,
    kind,
    url,
    image,
    approved: owner,
  });
  if (error) return fail("It didn't pin. Try again in a minute.", 500);

  return NextResponse.json({ ok: true, approved: owner }, { headers: noStore });
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) return null;
  return supabase;
}

export async function PATCH(request: NextRequest) {
  const supabase = await requireAdmin();
  if (!supabase) return fail("Approving posts is for admins.", 403);
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id) return fail("Which post?");
  const { error } = await supabase.from("rewind_wall").update({ approved: true }).eq("id", id);
  if (error) return fail(error.message, 500);
  return NextResponse.json({ ok: true }, { headers: noStore });
}

export async function DELETE(request: NextRequest) {
  const supabase = await requireAdmin();
  if (!supabase) return fail("Removing posts is for admins.", 403);
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id) return fail("Which post?");
  const { error } = await supabase.from("rewind_wall").delete().eq("id", id);
  if (error) return fail(error.message, 500);
  return NextResponse.json({ ok: true }, { headers: noStore });
}
