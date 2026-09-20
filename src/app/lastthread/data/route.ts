import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

// Everything LastThread has been edited into: page edits and posts.
//
// It lives as one row in site_content, the table the feed already uses for
// text an admin can change without deploying. That table is readable by
// everyone and writable by admins only, which is exactly the rule LastThread
// wants, so this needs no migration and no new table.
//
// GET is public: this is what makes an edit show for every visitor rather
// than only in the browser that made it.
// POST is admins only, checked here and again by the row level security
// policy on site_content, so a forged request fails twice.
export const dynamic = "force-dynamic";

const KEY = "lastthread";
const noStore = { "cache-control": "no-store" };

type Doc = {
  edits: Record<string, { text?: Record<string, string>; image?: Record<string, string> }>;
  posts: Post[];
};

type Post = {
  id: string;
  title: string;
  body?: string;
  sources?: string;
  era?: string;
  place?: string;
  channel?: string;
  picture?: string;
  author?: string;
  date?: string;
};

const empty: Doc = { edits: {}, posts: [] };

async function readDoc(): Promise<Doc> {
  const supabase = await createClient();
  const { data } = await supabase.from("site_content").select("value").eq("key", KEY).maybeSingle();
  if (!data?.value) return empty;
  try {
    const parsed = JSON.parse(data.value) as Partial<Doc>;
    return { edits: parsed.edits ?? {}, posts: parsed.posts ?? [] };
  } catch {
    // A row that will not parse is a bug somewhere, but it must not take the
    // site down: serve an empty document and let an admin overwrite it.
    return empty;
  }
}

export async function GET() {
  return NextResponse.json(await readDoc(), { headers: noStore });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Editing LastThread is for admins." }, { status: 403, headers: noStore });
  }

  let body: {
    type?: string;
    page?: string;
    address?: string;
    kind?: string;
    value?: string;
    post?: Post;
    id?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400, headers: noStore });
  }

  const doc = await readDoc();

  if (body.type === "edit") {
    const { page, address, kind, value } = body;
    if (!page || !address || (kind !== "text" && kind !== "image") || typeof value !== "string") {
      return NextResponse.json({ error: "Bad edit." }, { status: 400, headers: noStore });
    }
    const forPage = doc.edits[page] ?? {};
    const bucket = { ...(forPage[kind] ?? {}), [address]: value };
    doc.edits[page] = { ...forPage, [kind]: bucket };
  } else if (body.type === "post") {
    const post = body.post;
    if (!post || !post.title) {
      return NextResponse.json({ error: "A post needs a headline." }, { status: 400, headers: noStore });
    }
    doc.posts.unshift({
      ...post,
      id: post.id || `p${Date.now()}`,
      date: post.date || new Date().toISOString().slice(0, 10),
    });
  } else if (body.type === "delete") {
    doc.posts = doc.posts.filter((p) => p.id !== body.id);
  } else {
    return NextResponse.json({ error: "Unknown request." }, { status: 400, headers: noStore });
  }

  const value = JSON.stringify(doc);

  // Postgres will take a very large text value, but a row full of photographs
  // is slow for every visitor to download. Refuse before it gets there.
  if (value.length > 4_000_000) {
    return NextResponse.json(
      { error: "LastThread's saved content is full. Remove some pictures, or use smaller ones." },
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
