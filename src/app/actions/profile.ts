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
