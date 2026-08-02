"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { isImageFile, guessContentType, MAX_CLUB_IMAGE_BYTES, megabytes } from "@/lib/uploads";

export type BannerFormState = { error?: string; ok?: boolean };

async function uploadBannerImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bannerId: string,
  file: File
): Promise<{ error?: string }> {
  if (!isImageFile(file)) return { error: "Image must be a valid image file." };
  if (file.size > MAX_CLUB_IMAGE_BYTES) {
    return { error: `Image must be under ${megabytes(MAX_CLUB_IMAGE_BYTES)}MB.` };
  }
  const ext = file.name.split(".").pop() || "jpg";
  const path = `banner-ads/${bannerId}/image.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: guessContentType(file) });
  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);
  await supabase
    .from("banner_ads")
    .update({ image_url: `${publicUrl}?t=${Date.now()}` })
    .eq("id", bannerId);
  return {};
}

export async function submitBannerAd(
  _prevState: BannerFormState,
  formData: FormData
): Promise<BannerFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to request a banner." };

  const artistName = String(formData.get("artist_name") ?? "").trim();
  const linkUrl = String(formData.get("link_url") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!artistName) {
    return { error: "Artist/band name is required." };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("banner_ads")
    .insert({
      submitted_by: user.id,
      artist_name: artistName,
      link_url: linkUrl || null,
      message: message || null,
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    return { error: insertError?.message ?? "Something went wrong." };
  }

  const file = formData.get("image_file");
  if (file instanceof File && file.size > 0) {
    const { error } = await uploadBannerImage(supabase, inserted.id, file);
    if (error) return { error };
  }

  return { ok: true };
}

// House ads: the site owner's own rotating banners. Auto-approved (no
// pending review) since there's no one else to review them - only an
// admin can reach this action.
export async function adminUploadHouseAd(
  _prevState: BannerFormState,
  formData: FormData
): Promise<BannerFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) {
    return { error: "Not authorized." };
  }

  const artistName = String(formData.get("artist_name") ?? "").trim();
  const linkUrl = String(formData.get("link_url") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const file = formData.get("image_file");

  if (!artistName) {
    return { error: "Name is required." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image." };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("banner_ads")
    .insert({
      submitted_by: user.id,
      artist_name: artistName,
      link_url: linkUrl || null,
      message: message || null,
      status: "approved",
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    return { error: insertError?.message ?? "Something went wrong." };
  }

  const { error } = await uploadBannerImage(supabase, inserted.id, file);
  if (error) return { error };

  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true };
}
