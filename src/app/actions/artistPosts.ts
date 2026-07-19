"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ARTIST_PLATFORMS, ARTIST_PLATFORM_LABELS, type ArtistPlatform } from "@/lib/artistPlatforms";

export type ArtistPostFormState = {
  error?: string;
  ok?: boolean;
};

function isValidLink(platform: string, url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.replace(/^www\./, "");
    if (platform === "spotify") return host === "open.spotify.com";
    if (platform === "soundcloud") return host === "soundcloud.com";
    if (platform === "apple_music") return host === "music.apple.com";
    if (platform === "youtube") return host === "youtube.com" || host === "youtu.be";
    return false;
  } catch {
    return false;
  }
}

export async function createArtistPost(
  _prevState: ArtistPostFormState,
  formData: FormData
): Promise<ArtistPostFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const artistName = String(formData.get("artist_name") ?? "").trim().slice(0, 120);
  if (!artistName) return { error: "Creator/project name is required." };

  const platform = String(formData.get("platform") ?? "");
  if (!ARTIST_PLATFORMS.includes(platform as ArtistPlatform)) {
    return { error: "Choose a platform." };
  }

  const linkUrl = String(formData.get("link_url") ?? "").trim();
  if (!isValidLink(platform, linkUrl)) {
    return { error: `Link must be a valid ${ARTIST_PLATFORM_LABELS[platform as ArtistPlatform]} URL.` };
  }

  const description = String(formData.get("description") ?? "").trim().slice(0, 500) || null;

  const { error } = await supabase.from("artist_posts").insert({
    user_id: user.id,
    artist_name: artistName,
    platform,
    link_url: linkUrl,
    description,
  });

  if (error) return { error: error.message };

  revalidatePath("/artists");
  return { ok: true };
}

export async function deleteArtistPost(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const postId = String(formData.get("post_id") ?? "");
  if (!postId) return;

  await supabase.from("artist_posts").delete().eq("id", postId).eq("user_id", user.id);
  revalidatePath("/artists");
}

export async function reportArtistPost(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const postId = String(formData.get("post_id") ?? "");
  if (!postId) return;
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500) || null;

  await supabase.from("artist_post_reports").insert({
    artist_post_id: postId,
    reporter_id: user.id,
    reason,
  });
}

export type ArtistCommentFormState = {
  error?: string;
  ok?: boolean;
};

export async function addArtistPostComment(
  _prevState: ArtistCommentFormState,
  formData: FormData
): Promise<ArtistCommentFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const postId = String(formData.get("post_id") ?? "");
  if (!postId) return { error: "Missing post." };

  const body = String(formData.get("body") ?? "").trim().slice(0, 1000);
  if (!body) return { error: "Comment can't be empty." };

  const { error } = await supabase.from("artist_post_comments").insert({
    artist_post_id: postId,
    user_id: user.id,
    body,
  });

  if (error) return { error: error.message };

  revalidatePath(`/artists/${postId}`);
  return { ok: true };
}

export async function deleteArtistPostComment(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const commentId = String(formData.get("comment_id") ?? "");
  const postId = String(formData.get("post_id") ?? "");
  if (!commentId) return;

  await supabase.from("artist_post_comments").delete().eq("id", commentId).eq("user_id", user.id);
  if (postId) revalidatePath(`/artists/${postId}`);
}
