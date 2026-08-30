"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/dbError";
import { MEDIA_TYPES } from "@/lib/media";
import { MAX_QUEUE } from "@/lib/queue";

export type QueueState = { error?: string; ok?: boolean };

/**
 * Adds something to the signed-in member's list.
 *
 * Duplicates are not an error. The most common way to add something twice
 * is to add it from a review, forget, and add it again from another
 * review - and telling somebody off for that is a worse outcome than the
 * list quietly already containing what they wanted in it. The unique
 * index does the deduplicating; this just declines to complain about it.
 */
export async function addToQueue(_prev: QueueState, formData: FormData): Promise<QueueState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const mediaType = String(formData.get("media_type") ?? "");
  if (!MEDIA_TYPES.includes(mediaType as (typeof MEDIA_TYPES)[number])) {
    return { error: "Pick a category." };
  }

  const title = String(formData.get("title") ?? "").trim().slice(0, 160);
  if (!title) return { error: "What are you adding?" };

  const { count } = await supabase
    .from("queue_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("done_at", null);
  if ((count ?? 0) >= MAX_QUEUE) {
    return { error: `That's ${MAX_QUEUE} things queued up. Tick a few off first.` };
  }

  const { error } = await supabase.from("queue_items").insert({
    user_id: user.id,
    media_type: mediaType,
    title,
    subtitle: String(formData.get("subtitle") ?? "").trim().slice(0, 160) || null,
    image_url: String(formData.get("image_url") ?? "").trim() || null,
    from_post_id: String(formData.get("from_post_id") ?? "").trim() || null,
  });

  // 23505 is the unique index doing its job: it is already on the list,
  // which is the state the member wanted either way.
  if (error && error.code !== "23505") return { error: friendlyDbError(error.message) };

  revalidatePath("/queue");
  return { ok: true };
}

/** Ticked off. The row stays; only done_at moves. */
export async function markQueueDone(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase
    .from("queue_items")
    .update({ done_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/queue");
}

/** Back onto the list. Ticking something off by accident shouldn't be final. */
export async function markQueueUndone(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("queue_items").update({ done_at: null }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/queue");
}

/** Changed their mind entirely. */
export async function removeFromQueue(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Scoped to the owner as well as the id: RLS enforces it too, but this
  // way a wrong id is a no-op rather than a policy error.
  await supabase.from("queue_items").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/queue");
}
