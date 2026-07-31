"use server";

import { createClient } from "@/lib/supabase/server";
import { isImageFile, guessContentType, MAX_CLUB_IMAGE_BYTES, megabytes } from "@/lib/uploads";

export type BannerFormState = { error?: string; ok?: boolean };

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

  if (!artistName || !linkUrl) {
    return { error: "Artist/band name and link are required." };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("banner_ads")
    .insert({
      submitted_by: user.id,
      artist_name: artistName,
      link_url: linkUrl,
      message: message || null,
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    return { error: insertError?.message ?? "Something went wrong." };
  }

  const file = formData.get("image_file");
  if (file instanceof File && file.size > 0) {
    if (!isImageFile(file)) return { error: "Image must be a valid image file." };
    if (file.size > MAX_CLUB_IMAGE_BYTES) {
      return { error: `Image must be under ${megabytes(MAX_CLUB_IMAGE_BYTES)}MB.` };
    }
    const ext = file.name.split(".").pop() || "jpg";
    const path = `banner-ads/${inserted.id}/image.${ext}`;
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
      .eq("id", inserted.id);
  }

  return { ok: true };
}
