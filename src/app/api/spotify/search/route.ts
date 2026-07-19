import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidAccessToken, searchTracks } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query) {
    return NextResponse.json({ tracks: [] });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const accessToken = await getValidAccessToken(supabase, user.id);
  if (!accessToken) {
    return NextResponse.json({ error: "Spotify not connected." }, { status: 400 });
  }

  const tracks = await searchTracks(accessToken, query);
  return NextResponse.json({ tracks });
}
