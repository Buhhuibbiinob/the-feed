import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ collections: [] });
  }

  const { data } = await supabase
    .from("collections")
    .select("id, name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ collections: data ?? [] });
}
