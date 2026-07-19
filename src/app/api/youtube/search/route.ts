import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchVideos } from "@/lib/youtube";

export async function GET(request: NextRequest) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query) return NextResponse.json({ videos: [] });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const videos = await searchVideos(query);
  return NextResponse.json({ videos });
}
