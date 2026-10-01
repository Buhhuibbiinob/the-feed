import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { guessContentType, isImageFile, limitFor, MAX_PHOTO_BYTES, megabytes } from "@/lib/uploads";

// One picture for the portfolio: a DVD cover, a CD, the framed portrait.
//
// It goes in the avatars bucket, which is public to read and which every
// other picture on the site already uses, under portfolio/. The page
// shrinks photos in the browser before sending, so a phone photo arrives
// well under the limit; the limit here is for whatever slips past that.
export const dynamic = "force-dynamic";

const noStore = { "cache-control": "no-store" };

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) {
    return NextResponse.json({ error: "Only the owner can add pictures." }, { status: 403, headers: noStore });
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400, headers: noStore });
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No picture came through." }, { status: 400, headers: noStore });
  }
  if (!isImageFile(file)) {
    return NextResponse.json({ error: "That file is not a picture." }, { status: 400, headers: noStore });
  }
  const limit = limitFor(file, MAX_PHOTO_BYTES);
  if (file.size > limit) {
    return NextResponse.json(
      { error: `That picture is over ${megabytes(limit)}MB. Try a smaller one.` },
      { status: 413, headers: noStore }
    );
  }

  const contentType = guessContentType(file);
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `portfolio/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType, upsert: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: noStore });
  }

  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
  return NextResponse.json({ url: publicUrl }, { headers: noStore });
}
