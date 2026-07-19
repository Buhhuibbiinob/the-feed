"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function toggleLike(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const postId = String(formData.get("post_id") ?? "");
  const liked = String(formData.get("liked") ?? "") === "true";
  if (!postId) return;

  if (liked) {
    await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", user.id);
  } else {
    await supabase.from("likes").insert({ post_id: postId, user_id: user.id });
  }

  revalidatePath(`/post/${postId}`);
  revalidatePath("/");
}
