"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { guessContentType, isImageFile, megabytes } from "@/lib/uploads";
import { MAX_STICKERS, MAX_STICKER_BYTES, normalizeSticker } from "@/lib/stickers";
import { logEvent } from "@/lib/events";

export type StickerState = { error?: string; ok?: boolean };

async function revalidateOwn(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("profiles").select("username").eq("id", userId).maybeSingle();
  if (data?.username) revalidatePath(`/profile/${data.username}`);
}

export async function uploadSticker(
  _prev: StickerState,
  formData: FormData
): Promise<StickerState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const file = formData.get("sticker_file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image." };
  if (!isImageFile(file)) return { error: "That file isn't an image." };
  if (file.size > MAX_STICKER_BYTES) {
    return { error: `Stickers must be under ${megabytes(MAX_STICKER_BYTES) || 1.5}MB.` };
  }

  const { count } = await supabase
    .from("profile_stickers")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= MAX_STICKERS) {
    return { error: `That's ${MAX_STICKERS} stickers. Remove one first.` };
  }

  // Named by a fresh id rather than the file name, so uploading two
  // things both called "sticker.png" doesn't overwrite the first.
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${user.id}/stickers/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: false, contentType: guessContentType(file) });
  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  // Dropped slightly off-centre and stacked on top, so a second sticker
  // doesn't land exactly under the first.
  const { error } = await supabase.from("profile_stickers").insert({
    user_id: user.id,
    image_url: publicUrl,
    x: 50 + ((count ?? 0) % 3) * 8 - 8,
    y: 50 + ((count ?? 0) % 4) * 6 - 9,
    z: (count ?? 0) + 1,
  });
  if (error) return { error: error.message };

  await logEvent(supabase, user.id, "profile_edit", "sticker_add");
  await revalidateOwn(supabase, user.id);
  return { ok: true };
}

/**
 * Saves where a sticker was dragged to. Called once when the drag ends
 * rather than on every pointer move - a write per frame would be hundreds
 * of requests to place one sticker.
 */
export async function placeSticker(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const placement = normalizeSticker({
    x: formData.get("x"),
    y: formData.get("y"),
    scale: formData.get("scale"),
    rotation: formData.get("rotation"),
  });

  await supabase
    .from("profile_stickers")
    .update(placement)
    .eq("id", id)
    .eq("user_id", user.id);

  await revalidateOwn(supabase, user.id);
}

export async function deleteSticker(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { data: sticker } = await supabase
    .from("profile_stickers")
    .select("image_url")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  await supabase.from("profile_stickers").delete().eq("id", id).eq("user_id", user.id);

  // Take the file with it, so removing a sticker doesn't quietly leave the
  // image in storage forever.
  if (sticker?.image_url) {
    const marker = "/avatars/";
    const index = sticker.image_url.indexOf(marker);
    if (index !== -1) {
      const path = sticker.image_url.slice(index + marker.length).split("?")[0];
      await supabase.storage.from("avatars").remove([path]);
    }
  }

  await revalidateOwn(supabase, user.id);
}
