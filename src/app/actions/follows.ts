"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function toggleFollow(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const followedId = String(formData.get("followed_id") ?? "");
  const following = String(formData.get("following") ?? "") === "true";
  const username = String(formData.get("username") ?? "");
  if (!followedId || followedId === user.id) return;

  if (following) {
    await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("followed_id", followedId);
  } else {
    await supabase.from("follows").insert({ follower_id: user.id, followed_id: followedId });
  }

  if (username) revalidatePath(`/profile/${username}`);
  revalidatePath("/");
}
