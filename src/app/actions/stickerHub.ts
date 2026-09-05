"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { guessContentType, isImageFile, MAX_AVATAR_BYTES, megabytes } from "@/lib/uploads";
import { packStickerUrl } from "@/lib/stickerPack";

// Adding to and removing from your own sticker hub.
//
// When the placement layer went, so did the upload button - which was
// wrong. What made stickers a problem was that they were dragged loose
// over the whole page, not that people had them: a grid you add to is
// still a grid. So uploading is back, and it puts the sticker in the
// hub rather than on top of anything.

export async function removeHubSticker(formData: FormData) {
  const id = String(formData.get("sticker_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Scoped to the caller's own rows. The table's RLS says the same
  // thing, so this is the second lock rather than the only one.
  await supabase.from("profile_stickers").delete().eq("id", id).eq("user_id", user.id);

  revalidatePath("/profile", "layout");
}

export type HubUploadState = { error?: string; ok?: boolean };

/** Adds one sticker to your own hub. */
export async function addHubSticker(
  _prev: HubUploadState,
  formData: FormData
): Promise<HubUploadState> {
  const ownerId = String(formData.get("owner_id") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== ownerId) return { error: "Not your profile." };

  const file = formData.get("sticker_file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image." };
  if (!isImageFile(file)) return { error: "That file isn't an image." };
  if (file.size > MAX_AVATAR_BYTES) {
    return { error: `Sticker must be under ${megabytes(MAX_AVATAR_BYTES)}MB.` };
  }

  // A unique name per upload: stickers are a collection, so a second one
  // must not overwrite the first the way a fixed path would.
  const ext = file.name.split(".").pop() || "png";
  const path = `stickers/${user.id}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: false, contentType: guessContentType(file) });
  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  // x/y/scale/rotation/z all have defaults; the hub ignores them, and
  // leaving them at their defaults is what keeps the row valid for
  // anything that reads the table expecting a placement.
  const { error } = await supabase
    .from("profile_stickers")
    .insert({ user_id: user.id, image_url: publicUrl });
  if (error) return { error: error.message };

  revalidatePath("/profile", "layout");
  return { ok: true };
}

/**
 * Adds one of the site's own stickers to your hub.
 *
 * The id is looked up rather than trusted: packStickerUrl returns a path
 * only for a sticker that exists, so a forged request cannot put an
 * arbitrary string into image_url. That gate is the whole reason ids are
 * posted here instead of URLs.
 */
export async function addPackSticker(formData: FormData) {
  const ownerId = String(formData.get("owner_id") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== ownerId) return;

  const url = packStickerUrl(formData.get("sticker_id"));
  if (!url) return;

  // Once each: the hub is a collection, and four copies of the same
  // heart is a mess rather than a choice.
  const { data: existing } = await supabase
    .from("profile_stickers")
    .select("id")
    .eq("user_id", user.id)
    .eq("image_url", url)
    .maybeSingle();
  if (existing) return;

  await supabase.from("profile_stickers").insert({ user_id: user.id, image_url: url });
  revalidatePath("/profile", "layout");
}
