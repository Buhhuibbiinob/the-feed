"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function disconnectSpotify() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase.from("spotify_accounts").delete().eq("user_id", user.id);
  revalidatePath("/");
  revalidatePath("/settings");
}
