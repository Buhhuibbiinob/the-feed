"use server";

import { revalidatePath } from "next/cache";
import { isBackgroundFit, DEFAULT_BACKGROUND_FIT } from "@/lib/background";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_AVATAR_BYTES,
  MAX_BANNER_BYTES,
  MAX_BACKGROUND_BYTES,
  megabytes,
  isImageFile,
  guessContentType,
  limitFor,
} from "@/lib/uploads";
import { checkBioSafety } from "@/lib/contentSafety";
import { logEvent } from "@/lib/events";
import { isProfileFontId, normalizeColor } from "@/lib/profileSkin";
import { sanitizeProfileLayout } from "@/lib/profileLayout";
import { isObsessedKind } from "@/lib/obsessed";
import { isBannerAspect, DEFAULT_BANNER_ASPECT } from "@/lib/bannerShape";
import { isFavoriteKind, MAX_FAVORITES_PER_KIND } from "@/lib/favorites";

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

/**
 * Revalidates the member's profile after an edit, and logs the edit.
 *
 * The logging lives here rather than in each action because every edit
 * already funnels through this one call - putting it anywhere else would
 * mean a new control could ship without instrumentation and nobody would
 * notice until the numbers looked wrong.
 */
async function revalidateProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  editKind?: string
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();
  revalidatePath("/");
  if (profile) revalidatePath(`/profile/${profile.username}`);
  if (editKind) await logEvent(supabase, userId, "profile_edit", editKind);
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

  await revalidateProfile(supabase, user.id, "avatar_preset");
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
  if (!isImageFile(file)) {
    return { error: "File must be an image." };
  }
  const avatarLimit = limitFor(file, MAX_AVATAR_BYTES);
  if (file.size > avatarLimit) {
    return { error: `Image must be under ${megabytes(avatarLimit)}MB.` };
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${user.id}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: guessContentType(file) });
  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: `${publicUrl}?t=${Date.now()}` })
    .eq("id", user.id);

  if (error) return { error: error.message };

  await revalidateProfile(supabase, user.id, "avatar_upload");
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

  const bioSafety = checkBioSafety(bio);
  if (!bioSafety.allowed) {
    return { error: bioSafety.reason };
  }

  // Styling rides along with the text so the two can't get out of step -
  // saving a bio and saving how it looks is one action to the member.
  const fontValue = formData.get("bio_font");
  const bioFont = isProfileFontId(fontValue) ? fontValue : null;
  const bioColor = normalizeColor(formData.get("bio_color"));

  const { error } = await supabase
    .from("profiles")
    .update({ bio, bio_font: bioFont, bio_color: bioColor })
    .eq("id", user.id);
  if (error) return { error: error.message };

  await revalidateProfile(supabase, user.id, "bio");
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
  if (!isImageFile(file)) {
    return { error: "File must be an image." };
  }
  const bannerLimit = limitFor(file, MAX_BANNER_BYTES);
  if (file.size > bannerLimit) {
    return { error: `Image must be under ${megabytes(bannerLimit)}MB.` };
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${user.id}/banner.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: guessContentType(file) });
  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  const aspectValue = formData.get("banner_aspect");
  const aspect = isBannerAspect(aspectValue) ? aspectValue : DEFAULT_BANNER_ASPECT;

  const { error } = await supabase
    .from("profiles")
    .update({ banner_url: `${publicUrl}?t=${Date.now()}`, banner_aspect: aspect })
    .eq("id", user.id);

  if (error) return { error: error.message };

  await revalidateProfile(supabase, user.id, "banner");
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
  if (!isImageFile(file)) {
    return { error: "File must be an image." };
  }
  if (file.size > MAX_BACKGROUND_BYTES) {
    return { error: `Image must be under ${megabytes(MAX_BACKGROUND_BYTES)}MB.` };
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${user.id}/background.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: guessContentType(file) });
  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  const fitValue = formData.get("background_fit");
  const fit = isBackgroundFit(fitValue) ? fitValue : DEFAULT_BACKGROUND_FIT;
  const flipped = formData.get("background_flipped") === "on";

  const { error } = await supabase
    .from("profiles")
    .update({
      custom_background_url: `${publicUrl}?t=${Date.now()}`,
      theme: "custom",
      background_fit: fit,
      background_flipped: flipped,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  await logEvent(supabase, user.id, "profile_edit", "background_upload");
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Changes how the existing background is laid out, without re-uploading it.
 * Separate from the upload so someone can try Fill against Tile without
 * pushing the same file up three times.
 */
export async function updateBackgroundLayout(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const fitValue = formData.get("background_fit");
  if (!isBackgroundFit(fitValue)) return { error: "Pick how the image should fill the page." };

  const { error } = await supabase
    .from("profiles")
    .update({
      background_fit: fitValue,
      background_flipped: formData.get("background_flipped") === "on",
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  await logEvent(supabase, user.id, "profile_edit", "background_layout");
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

  await revalidateProfile(supabase, user.id, "status");
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

  await revalidateProfile(supabase, user.id, "status_clear");
}

export async function updateProfileLayout(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // The editor submits the whole arrangement as one comma-joined list
  // rather than a field per section, so a section that was dragged and a
  // section that was switched off arrive together and can't half-apply.
  const raw = String(formData.get("layout") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const layout = sanitizeProfileLayout(raw);
  if (layout.length === 0) return { error: "Pick at least one section." };

  const { error } = await supabase.from("profiles").update({ profile_layout: layout }).eq("id", user.id);
  if (error) return { error: error.message };

  await revalidateProfile(supabase, user.id, "layout");
  return { ok: true };
}

export async function updateProfileSkin(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // A blank field clears that colour rather than failing, so "back to the
  // site theme" is reachable without a separate reset action.
  const { error } = await supabase
    .from("profiles")
    .update({
      profile_bg_color: normalizeColor(formData.get("profile_bg_color")),
      profile_panel_color: normalizeColor(formData.get("profile_panel_color")),
      profile_text_color: normalizeColor(formData.get("profile_text_color")),
      profile_accent_color: normalizeColor(formData.get("profile_accent_color")),
    })
    .eq("id", user.id);
  if (error) return { error: error.message };

  await revalidateProfile(supabase, user.id, "colors");
  return { ok: true };
}

export async function setObsessed(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const kind = formData.get("kind");
  if (!isObsessedKind(kind)) return { error: "Pick what kind of thing it is." };

  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  if (!title) return { error: "Give it a name." };

  const note = String(formData.get("note") ?? "").trim().slice(0, 140) || null;
  if (note) {
    const safety = checkBioSafety(note);
    if (!safety.allowed) return { error: safety.reason };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      obsessed_kind: kind,
      obsessed_title: title,
      obsessed_note: note,
      obsessed_image_url: String(formData.get("image_url") ?? "").trim() || null,
      obsessed_updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error) return { error: error.message };

  await revalidateProfile(supabase, user.id, "obsessed");
  return { ok: true };
}

export async function clearObsessed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({
      obsessed_kind: null,
      obsessed_title: null,
      obsessed_note: null,
      obsessed_image_url: null,
      obsessed_updated_at: null,
    })
    .eq("id", user.id);

  await revalidateProfile(supabase, user.id, "obsessed_clear");
}

export async function setProfileSong(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const youtubeId = String(formData.get("youtube_id") ?? "").trim() || null;
  const spotifyId = String(formData.get("spotify_id") ?? "").trim() || null;
  if (!youtubeId && !spotifyId) return { error: "Pick a track first." };

  const title = String(formData.get("title") ?? "").trim().slice(0, 160);
  if (!title) return { error: "Pick a track first." };

  const { error } = await supabase
    .from("profiles")
    .update({
      profile_song_youtube_id: youtubeId,
      profile_song_spotify_id: spotifyId,
      profile_song_title: title,
      profile_song_artist: String(formData.get("artist") ?? "").trim().slice(0, 160) || null,
      profile_song_thumbnail_url: String(formData.get("thumbnail_url") ?? "").trim() || null,
      // Autoplay is opt-in and off by default. A page that starts making
      // noise unannounced is the part of the Myspace profile song nobody
      // actually misses.
      profile_song_autoplay: formData.get("autoplay") === "on",
    })
    .eq("id", user.id);
  if (error) return { error: error.message };

  await revalidateProfile(supabase, user.id, "song");
  return { ok: true };
}

export async function clearProfileSong() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({
      profile_song_youtube_id: null,
      profile_song_spotify_id: null,
      profile_song_title: null,
      profile_song_artist: null,
      profile_song_thumbnail_url: null,
      profile_song_autoplay: false,
    })
    .eq("id", user.id);

  await revalidateProfile(supabase, user.id, "song_clear");
}

export async function addFavorite(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const kind = formData.get("kind");
  if (!isFavoriteKind(kind)) return { error: "Unknown list." };

  const title = String(formData.get("title") ?? "").trim().slice(0, 120);
  if (!title) return { error: "Type a name first." };

  const { data: existing } = await supabase
    .from("profile_favorites")
    .select("position")
    .eq("user_id", user.id)
    .eq("kind", kind)
    .order("position", { ascending: false })
    .limit(1);

  const { count } = await supabase
    .from("profile_favorites")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("kind", kind);

  if ((count ?? 0) >= MAX_FAVORITES_PER_KIND) {
    return { error: `That list holds ${MAX_FAVORITES_PER_KIND}. Remove one first.` };
  }

  const nextPosition = ((existing?.[0]?.position as number | undefined) ?? -1) + 1;

  const { error } = await supabase.from("profile_favorites").insert({
    user_id: user.id,
    kind,
    title,
    subtitle: String(formData.get("subtitle") ?? "").trim().slice(0, 120) || null,
    image_url: String(formData.get("image_url") ?? "").trim() || null,
    position: nextPosition,
  });
  if (error) return { error: error.message };

  await revalidateProfile(supabase, user.id, "favorite_add");
  return { ok: true };
}

export async function removeFavorite(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Scoped to the caller as well as the id: RLS already enforces this, but
  // the filter means a wrong id fails as a no-op rather than a policy error.
  await supabase.from("profile_favorites").delete().eq("id", id).eq("user_id", user.id);

  await revalidateProfile(supabase, user.id, "favorite_remove");
}

export async function moveFavorite(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id || (direction !== "up" && direction !== "down")) return;

  const { data: row } = await supabase
    .from("profile_favorites")
    .select("id, kind, position")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) return;

  // Positions can have gaps (they're only ever compared, never counted on
  // to be contiguous), so the neighbour is whichever row is nearest on the
  // requested side rather than position +/- 1.
  const { data: neighbours } = await supabase
    .from("profile_favorites")
    .select("id, position")
    .eq("user_id", user.id)
    .eq("kind", row.kind)
    .order("position", { ascending: direction === "down" })
    [direction === "up" ? "lt" : "gt"]("position", row.position)
    .limit(1);

  const neighbour = neighbours?.[0];
  if (!neighbour) return;

  await Promise.all([
    supabase.from("profile_favorites").update({ position: neighbour.position }).eq("id", row.id).eq("user_id", user.id),
    supabase.from("profile_favorites").update({ position: row.position }).eq("id", neighbour.id).eq("user_id", user.id),
  ]);

  await revalidateProfile(supabase, user.id, "favorite_move");
}
