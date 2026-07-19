"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ProfileFormState = {
  error?: string;
  ok?: boolean;
};

const PRESET_AVATARS = [
  "/avatars/preset-1.svg",
  "/avatars/preset-2.svg",
  "/avatars/preset-3.svg",
  "/avatars/preset-4.svg",
  "/avatars/preset-5.svg",
  "/avatars/preset-6.svg",
];

async function revalidateProfile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();
  revalidatePath("/");
  if (profile) revalidatePath(`/profile/${profile.username}`);
}

export async function selectPresetAvatar(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const preset = String(formData.get("preset") ?? "");
  if (!PRESET_AVATARS.includes(preset)) return { error: "Invalid preset." };

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: preset })
    .eq("id", user.id);

  if (error) return { error: error.message };

  await revalidateProfile(supabase, user.id);
  return { ok: true };
}

export async function uploadAvatar(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const file = formData.get("avatar_file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image file." };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "File must be an image." };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { error: "Image must be under 2MB." };
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${user.id}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: `${publicUrl}?t=${Date.now()}` })
    .eq("id", user.id);

  if (error) return { error: error.message };

  await revalidateProfile(supabase, user.id);
  return { ok: true };
}

export async function updateBio(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const bio = String(formData.get("bio") ?? "").slice(0, 500);

  const { error } = await supabase.from("profiles").update({ bio }).eq("id", user.id);
  if (error) return { error: error.message };

  await revalidateProfile(supabase, user.id);
  return { ok: true };
}

export async function uploadBanner(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const file = formData.get("banner_file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image file." };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "File must be an image." };
  }
  if (file.size > 4 * 1024 * 1024) {
    return { error: "Image must be under 4MB." };
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${user.id}/banner.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  const { error } = await supabase
    .from("profiles")
    .update({ banner_url: `${publicUrl}?t=${Date.now()}` })
    .eq("id", user.id);

  if (error) return { error: error.message };

  await revalidateProfile(supabase, user.id);
  return { ok: true };
}

export async function uploadCustomBackground(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const file = formData.get("background_file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image file." };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "File must be an image." };
  }
  if (file.size > 6 * 1024 * 1024) {
    return { error: "Image must be under 6MB." };
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${user.id}/background.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  const { error } = await supabase
    .from("profiles")
    .update({ custom_background_url: `${publicUrl}?t=${Date.now()}`, theme: "custom" })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setStatus(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const mediaType = String(formData.get("media_type") ?? "");
  if (mediaType !== "music" && mediaType !== "movie_tv") {
    return { error: "Invalid media type." };
  }
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title is required." };
  const artist = String(formData.get("artist") ?? "").trim() || null;
  const coverUrl = String(formData.get("cover_url") ?? "").trim() || null;

  const { error } = await supabase
    .from("profiles")
    .update({
      status_media_type: mediaType,
      status_title: title,
      status_artist: artist,
      status_cover_url: coverUrl,
      status_updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  await revalidateProfile(supabase, user.id);
  return { ok: true };
}

export async function clearStatus(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({
      status_media_type: null,
      status_title: null,
      status_artist: null,
      status_cover_url: null,
      status_updated_at: null,
    })
    .eq("id", user.id);

  await revalidateProfile(supabase, user.id);
}
