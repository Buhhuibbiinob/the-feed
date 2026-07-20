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

// Pulls the 11-char video id out of any common YouTube URL shape
// (watch?v=, youtu.be/, /embed/, /shorts/); returns null if it isn't one.
function parseYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return u.pathname.slice(1, 12) || null;
    if (host === "youtube.com" || host === "m.youtube.com") {
      const v = u.searchParams.get("v");
      if (v) return v.slice(0, 11);
      const m = u.pathname.match(/\/(embed|shorts)\/([\w-]{11})/);
      if (m) return m[2];
    }
    return null;
  } catch {
    return null;
  }
}

// Lets a club member post directly into that club (a music video, a review,
// etc.) rather than only through the main feed. The post is pinned to this
// club via club_id and inherits the club's media_type.
export async function createClubPost(
  _prevState: PostFormState,
  formData: FormData
): Promise<PostFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const clubId = String(formData.get("club_id") ?? "");
  if (!clubId) return { error: "Missing club." };

  const { data: club } = await supabase
    .from("clubs")
    .select("media_type")
    .eq("id", clubId)
    .maybeSingle<{ media_type: MediaType }>();
  if (!club) return { error: "Club not found." };

  const { data: membership } = await supabase
    .from("club_members")
    .select("user_id")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { error: "Join the club to post in it." };

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title || !body) return { error: "Title and text are required." };

  const ratingRaw = String(formData.get("rating") ?? "");
  const rating = ratingRaw ? Number(ratingRaw) : null;
  if (rating !== null && (rating < 1 || rating > 5)) {
    return { error: "Rating must be between 1 and 5." };
  }

  const youtubeUrl = String(formData.get("youtube_url") ?? "").trim();
  let youtubeVideoId: string | null = null;
  if (youtubeUrl) {
    youtubeVideoId = parseYoutubeId(youtubeUrl);
    if (!youtubeVideoId) return { error: "That doesn't look like a YouTube link." };
  }

  const { error } = await supabase.from("posts").insert({
    user_id: user.id,
    media_type: club.media_type,
    title,
    body,
    rating,
    youtube_video_id: youtubeVideoId,
    club_id: clubId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/clubs/${clubId}`);
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
