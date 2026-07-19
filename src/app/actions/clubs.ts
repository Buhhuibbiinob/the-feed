"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { MAX_CLUB_IMAGE_BYTES, megabytes, isImageFile, guessContentType } from "@/lib/uploads";
import { slugify } from "@/lib/slug";

export type ClubImageFormState = {
  error?: string;
  ok?: boolean;
};

export type CreateClubFormState = {
  error?: string;
  ok?: boolean;
  clubId?: string;
};

export async function createClub(
  _prevState: CreateClubFormState,
  formData: FormData
): Promise<CreateClubFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const mediaType = String(formData.get("media_type") ?? "");
  if (mediaType !== "music" && mediaType !== "movie_tv") {
    return { error: "Choose a category." };
  }

  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  if (!name) return { error: "Club name is required." };

  const slug = slugify(name);
  if (!slug) return { error: "Club name is required." };

  const { data: existing } = await supabase
    .from("clubs")
    .select("id")
    .eq("media_type", mediaType)
    .eq("slug", slug)
    .maybeSingle();
  if (existing) return { error: "A club with that name already exists." };

  const { data: created, error } = await supabase
    .from("clubs")
    .insert({ media_type: mediaType, name, slug, status: "pending", created_by: user.id })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath("/clubs");
  return { ok: true, clubId: created.id };
}

export async function joinClub(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const clubId = String(formData.get("club_id") ?? "");
  if (!clubId) return;

  await supabase.from("club_members").insert({ club_id: clubId, user_id: user.id });
  revalidatePath(`/clubs/${clubId}`);
  revalidatePath("/clubs");
}

export async function leaveClub(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const clubId = String(formData.get("club_id") ?? "");
  if (!clubId) return;

  await supabase.from("club_members").delete().eq("club_id", clubId).eq("user_id", user.id);
  revalidatePath(`/clubs/${clubId}`);
  revalidatePath("/clubs");
}

export async function reportClub(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const clubId = String(formData.get("club_id") ?? "");
  if (!clubId) return;
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500) || null;

  await supabase.from("club_reports").insert({ club_id: clubId, reporter_id: user.id, reason });
  revalidatePath(`/clubs/${clubId}`);
}

async function canManageClub(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  clubId: string
): Promise<boolean> {
  if (await isAdmin(supabase, userId)) return true;
  const { data: club } = await supabase.from("clubs").select("created_by").eq("id", clubId).maybeSingle();
  return club?.created_by === userId;
}

async function uploadClubImage(
  formData: FormData,
  fileField: "banner_file" | "avatar_file",
  kind: "banner" | "avatar",
  column: "banner_url" | "avatar_url"
): Promise<ClubImageFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const clubId = String(formData.get("club_id") ?? "");
  if (!clubId) return { error: "Missing club." };
  if (!(await canManageClub(supabase, user.id, clubId))) {
    return { error: "You don't manage this club." };
  }

  const file = formData.get(fileField);
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image file." };
  }
  if (!isImageFile(file)) {
    return { error: "File must be an image." };
  }
  if (file.size > MAX_CLUB_IMAGE_BYTES) {
    return { error: `Image must be under ${megabytes(MAX_CLUB_IMAGE_BYTES)}MB.` };
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `club-assets/${clubId}/${kind}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: guessContentType(file) });
  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  const { error } = await supabase
    .from("clubs")
    .update({ [column]: `${publicUrl}?t=${Date.now()}` })
    .eq("id", clubId);
  if (error) return { error: error.message };

  revalidatePath(`/clubs/${clubId}`);
  return { ok: true };
}

export async function uploadClubBanner(
  _prevState: ClubImageFormState,
  formData: FormData
): Promise<ClubImageFormState> {
  return uploadClubImage(formData, "banner_file", "banner", "banner_url");
}

export async function uploadClubAvatar(
  _prevState: ClubImageFormState,
  formData: FormData
): Promise<ClubImageFormState> {
  return uploadClubImage(formData, "avatar_file", "avatar", "avatar_url");
}
