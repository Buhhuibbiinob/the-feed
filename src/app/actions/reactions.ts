"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isDrawnEmoji } from "@/lib/emojiText";

/**
 * Reacts to a review, or takes the reaction back.
 *
 * The emoji is checked against the site's own set rather than accepted
 * as text. Anything else would let a row hold a character there is no
 * artwork for, which renders as whatever the reader's phone draws - the
 * exact inconsistency the drawn set exists to remove.
 */
export async function reactToPost(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const postId = String(formData.get("post_id") ?? "");
  const emoji = String(formData.get("emoji") ?? "");
  if (!postId) return;

  if (!emoji) {
    await supabase.from("post_reactions").delete().eq("post_id", postId).eq("user_id", user.id);
  } else {
    if (!isDrawnEmoji(emoji)) return;
    await supabase
      .from("post_reactions")
      .upsert({ post_id: postId, user_id: user.id, emoji }, { onConflict: "post_id,user_id" });
  }

  revalidatePath(`/post/${postId}`);
  revalidatePath("/");
}
