import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAppAccessToken, searchTracks } from "@/lib/spotify";

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

  // Track search is public catalog data, so use the app-level client-credentials
  // token rather than requiring the poster to have personally connected Spotify.
  const accessToken = await getAppAccessToken();
  const tracks = await searchTracks(accessToken, query);
  return NextResponse.json({ tracks });
}
