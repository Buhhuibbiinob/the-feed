"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MEDIA_TYPES, type MediaType } from "@/lib/media";
import { findOrCreateClub } from "@/lib/clubs";

export type PostFormState = {
  error?: string;
  ok?: boolean;
};

export async function createPost(
  _prevState: PostFormState,
  formData: FormData
): Promise<PostFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to post." };
  }

  const mediaType = String(formData.get("media_type") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const ratingRaw = String(formData.get("rating") ?? "");
  const rating = ratingRaw ? Number(ratingRaw) : null;
  const artist = String(formData.get("artist") ?? "").trim();
  const coverUrl = String(formData.get("cover_url") ?? "").trim();
  const spotifyTrackId = String(formData.get("spotify_track_id") ?? "").trim();
  const youtubeVideoId = String(formData.get("youtube_video_id") ?? "").trim();

  if (!MEDIA_TYPES.includes(mediaType as (typeof MEDIA_TYPES)[number])) {
    return { error: "Choose a valid category." };
  }
  if (!title || !body) {
    return { error: "Title and review text are required." };
  }
  if (rating !== null && (rating < 1 || rating > 5)) {
    return { error: "Rating must be between 1 and 5." };
  }

  const clubName = mediaType === "music" ? artist : title;
  const clubId = clubName
    ? await findOrCreateClub(supabase, mediaType as MediaType, clubName)
    : null;

  const { error } = await supabase.from("posts").insert({
    user_id: user.id,
    media_type: mediaType,
    title,
    body,
    rating,
    artist: artist || null,
    cover_url: coverUrl || null,
    spotify_track_id: spotifyTrackId || null,
    youtube_video_id: youtubeVideoId || null,
    club_id: clubId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/clubs");
  return { ok: true };
}

export async function updatePost(
  _prevState: PostFormState,
  formData: FormData
): Promise<PostFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const postId = String(formData.get("post_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const ratingRaw = String(formData.get("rating") ?? "");
  const rating = ratingRaw ? Number(ratingRaw) : null;

  if (!postId || !title || !body) {
    return { error: "Title and review text are required." };
  }
  if (rating !== null && (rating < 1 || rating > 5)) {
    return { error: "Rating must be between 1 and 5." };
  }

  const { error } = await supabase
    .from("posts")
    .update({ title, body, rating })
    .eq("id", postId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  revalidatePath(`/post/${postId}`);
  return { ok: true };
}

export async function deletePost(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const postId = String(formData.get("post_id") ?? "");
  if (!postId) return;

  await supabase.from("posts").delete().eq("id", postId).eq("user_id", user.id);

  revalidatePath("/");
}
