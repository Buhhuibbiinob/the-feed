"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { guessContentType, isImageFile, megabytes } from "@/lib/uploads";
import { MAX_STICKERS, MAX_STICKER_BYTES, normalizeSticker } from "@/lib/stickers";
import { packStickerUrl } from "@/lib/stickerPack";
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

  // Dropped off-centre, stacked on top, and slightly crooked. Nobody
  // sticks a sticker on perfectly straight, and a grid of them sitting at
  // exactly 0 degrees is the thing that stops it looking like a scrapbook.
  const nth = count ?? 0;
  const { error } = await supabase.from("profile_stickers").insert({
    user_id: user.id,
    image_url: publicUrl,
    x: 50 + (nth % 3) * 8 - 8,
    y: 50 + (nth % 4) * 6 - 9,
    rotation: Math.round((Math.random() * 24 - 12) * 10) / 10,
    z: nth + 1,
  });
  if (error) return { error: error.message };

  await logEvent(supabase, user.id, "profile_edit", "sticker_add");
  await revalidateOwn(supabase, user.id);
  return { ok: true };
}

/**
 * Drops one of the site's own stickers onto the page.
 *
 * Takes an id, never a URL: the id is looked up in the pack and the path
 * is built here, so nothing a client posts can end up in image_url.
 *
 * No upload, no file picker, no going and finding a PNG first - which is
 * what "Choose File / no file selected" was actually asking people to do
 * before they could decorate anything.
 */
export async function addPackSticker(
  _prev: StickerState,
  formData: FormData
): Promise<StickerState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const imageUrl = packStickerUrl(formData.get("pack_id"));
  if (!imageUrl) return { error: "Unknown sticker." };

  const { count } = await supabase
    .from("profile_stickers")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= MAX_STICKERS) {
    return { error: `That's ${MAX_STICKERS} stickers. Remove one first.` };
  }

  // Same scatter as an upload: stacked slightly off each other and
  // crooked, so tapping the heart four times gives you four hearts you
  // can see rather than one heart with three hidden underneath.
  const nth = count ?? 0;
  const { error } = await supabase.from("profile_stickers").insert({
    user_id: user.id,
    image_url: imageUrl,
    x: 50 + (nth % 3) * 8 - 8,
    y: 50 + (nth % 4) * 6 - 9,
    rotation: Math.round((Math.random() * 24 - 12) * 10) / 10,
    z: nth + 1,
  });
  if (error) return { error: error.message };

  await logEvent(supabase, user.id, "profile_edit", "sticker_pack_add");
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
    scaleY: formData.get("scale_y"),
    rotation: formData.get("rotation"),
    skew: formData.get("skew"),
  });

  // z only ever carries a sign here - which layer the sticker belongs to.
  // Its exact magnitude is stacking order within that layer.
  const rawZ = Number(formData.get("z"));
  const z = Number.isFinite(rawZ) ? Math.max(-99, Math.min(99, Math.round(rawZ))) : null;

  await supabase
    .from("profile_stickers")
    .update(z === null ? placement : { ...placement, z })
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
