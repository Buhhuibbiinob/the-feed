"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSlotIndex, parseYoutubeId } from "@/lib/mediaSlots";

export type SlotFormState = { error?: string; ok?: boolean };

async function requireOwner(ownerId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Only your own boxes. The table's RLS says the same; this is the
  // second lock and the readable error.
  if (!user || user.id !== ownerId) return null;
  return { supabase, userId: user.id };
}

/** Fills one of the six boxes with a picture or a video. */
export async function setMediaSlot(
  _prev: SlotFormState,
  formData: FormData
): Promise<SlotFormState> {
  const ownerId = String(formData.get("owner_id") ?? "");
  const auth = await requireOwner(ownerId);
  if (!auth) return { error: "Not your profile." };

  const slot = Number(formData.get("slot"));
  if (!isSlotIndex(slot)) return { error: "Unknown box." };

  const kind = String(formData.get("kind") ?? "image") === "video" ? "video" : "image";
  const title = String(formData.get("title") ?? "").trim().slice(0, 60) || null;
  const subtitle = String(formData.get("subtitle") ?? "").trim().slice(0, 60) || null;

  if (kind === "video") {
    const youtubeId = parseYoutubeId(formData.get("youtube"));
    if (!youtubeId) return { error: "Paste a YouTube link or video id." };
    const { error } = await auth.supabase.from("profile_media_slots").upsert(
      { user_id: auth.userId, slot, kind, youtube_id: youtubeId, image_url: null, title, subtitle },
      { onConflict: "user_id,slot" }
    );
    if (error) return { error: describe(error.message) };
  } else {
    const imageUrl = String(formData.get("image_url") ?? "").trim();
    // Relative uploads or full URLs only - never a javascript: or data:
    // string, which is the one way a text field like this turns into a
    // way to run something.
    if (!/^(https?:\/\/|\/)/.test(imageUrl)) return { error: "Paste an image URL." };
    const { error } = await auth.supabase.from("profile_media_slots").upsert(
      { user_id: auth.userId, slot, kind, image_url: imageUrl.slice(0, 500), youtube_id: null, title, subtitle },
      { onConflict: "user_id,slot" }
    );
    if (error) return { error: describe(error.message) };
  }

  revalidatePath("/profile", "layout");
  return { ok: true };
}

/** Empties a box, which puts the automatic content back. */
export async function clearMediaSlot(formData: FormData) {
  const ownerId = String(formData.get("owner_id") ?? "");
  const auth = await requireOwner(ownerId);
  if (!auth) return;

  const slot = Number(formData.get("slot"));
  if (!isSlotIndex(slot)) return;

  await auth.supabase
    .from("profile_media_slots")
    .delete()
    .eq("user_id", auth.userId)
    .eq("slot", slot);
  revalidatePath("/profile", "layout");
}

function describe(message: string): string {
  return /relation .* does not exist|schema cache/i.test(message)
    ? "Custom boxes aren't set up yet - run migration 011 in the Supabase SQL editor."
    : message;
}
