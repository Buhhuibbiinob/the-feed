import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { describeSearchFailure, searchVideosDetailed } from "@/lib/youtube";

export async function GET(request: NextRequest) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query) return NextResponse.json({ videos: [] });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // Typed by a person, into a box, right now.
  const { videos, failure } = await searchVideosDetailed(query, 8, { priority: "user" });
  // The reason travels with the result. An empty list that means "search
  // is broken" and an empty list that means "no such song" are different
  // answers, and the box needs to be able to say which.
  return NextResponse.json({
    videos,
    ...(failure ? { error: describeSearchFailure(failure) } : {}),
  });
}
