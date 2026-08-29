"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkBioSafety } from "@/lib/contentSafety";

// Writes for the profile modules that carry their own content: the
// signatures, regulars, and pinned reviews.

const MAX_CONNECTIONS = 8;
const MAX_PINNED = 3;

async function revalidateProfileById(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const { data } = await supabase.from("profiles").select("username").eq("id", userId).maybeSingle();
  if (data?.username) revalidatePath(`/profile/${data.username}`);
}

export type ModuleFormState = { error?: string; ok?: boolean };

export async function signGuestbook(
  _prev: ModuleFormState,
  formData: FormData
): Promise<ModuleFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to leave a message." };

  const profileId = String(formData.get("profile_id") ?? "");
  const body = String(formData.get("body") ?? "").trim().slice(0, 500);
  if (!profileId) return { error: "Unknown profile." };
  if (!body) return { error: "Write something first." };

  const safety = checkBioSafety(body);
  if (!safety.allowed) return { error: safety.reason };

  // Blocks apply here as they do in DMs: a wall post is still one person
  // putting words on another person's page.
  const { data: block } = await supabase
    .from("blocked_users")
    .select("blocker_id")
    .eq("blocker_id", profileId)
    .eq("blocked_id", user.id)
    .maybeSingle();
  if (block) return { error: "You can't post on that profile." };

  const { error } = await supabase
    .from("guestbook_entries")
    .insert({ profile_id: profileId, author_id: user.id, body });
  if (error) return { error: error.message };

  await revalidateProfileById(supabase, profileId);
  return { ok: true };
}

export async function deleteGuestbookEntry(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Who may delete is enforced by RLS (author, wall owner, or admin); this
  // only needs the row to find the page to revalidate.
  const { data: entry } = await supabase
    .from("guestbook_entries")
    .select("profile_id")
    .eq("id", id)
    .maybeSingle();

  await supabase.from("guestbook_entries").delete().eq("id", id);
  if (entry?.profile_id) await revalidateProfileById(supabase, entry.profile_id);
}

export async function addTopConnection(
  _prev: ModuleFormState,
  formData: FormData
): Promise<ModuleFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const username = String(formData.get("username") ?? "").trim();
  if (!username) return { error: "Type a username." };

  const { data: friend } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (!friend) return { error: `No member called "${username}".` };
  if (friend.id === user.id) return { error: "You're already on your own profile." };

  const { count } = await supabase
    .from("top_connections")
    .select("friend_id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= MAX_CONNECTIONS) {
    return { error: `It's a Top ${MAX_CONNECTIONS}. Remove someone first.` };
  }

  const { data: last } = await supabase
    .from("top_connections")
    .select("position")
    .eq("user_id", user.id)
    .order("position", { ascending: false })
    .limit(1);

  const { error } = await supabase.from("top_connections").insert({
    user_id: user.id,
    friend_id: friend.id,
    position: ((last?.[0]?.position as number | undefined) ?? -1) + 1,
  });
  if (error) {
    // The primary key makes a duplicate an error; say so in words.
    return { error: error.code === "23505" ? `${username} is already one of your Regulars.` : error.message };
  }

  await revalidateProfileById(supabase, user.id);
  return { ok: true };
}

export async function removeTopConnection(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const friendId = String(formData.get("friend_id") ?? "");
  if (!friendId) return;

  await supabase
    .from("top_connections")
    .delete()
    .eq("user_id", user.id)
    .eq("friend_id", friendId);
  await revalidateProfileById(supabase, user.id);
}

export async function moveTopConnection(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const friendId = String(formData.get("friend_id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!friendId || (direction !== "up" && direction !== "down")) return;

  const { data: row } = await supabase
    .from("top_connections")
    .select("friend_id, position")
    .eq("user_id", user.id)
    .eq("friend_id", friendId)
    .maybeSingle();
  if (!row) return;

  // Positions can have gaps, so the neighbour is the nearest row on that
  // side rather than position +/- 1.
  const { data: neighbours } = await supabase
    .from("top_connections")
    .select("friend_id, position")
    .eq("user_id", user.id)
    .order("position", { ascending: direction === "down" })
    [direction === "up" ? "lt" : "gt"]("position", row.position)
    .limit(1);

  const neighbour = neighbours?.[0];
  if (!neighbour) return;

  await Promise.all([
    supabase
      .from("top_connections")
      .update({ position: neighbour.position })
      .eq("user_id", user.id)
      .eq("friend_id", row.friend_id),
    supabase
      .from("top_connections")
      .update({ position: row.position })
      .eq("user_id", user.id)
      .eq("friend_id", neighbour.friend_id),
  ]);

  await revalidateProfileById(supabase, user.id);
}

export async function togglePinnedPost(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const postId = String(formData.get("post_id") ?? "");
  if (!postId) return;

  // Only your own reviews: featuring somebody else's on your profile would
  // read as yours.
  const { data: post } = await supabase
    .from("posts")
    .select("user_id")
    .eq("id", postId)
    .maybeSingle();
  if (!post || post.user_id !== user.id) return;

  const { data: existing } = await supabase
    .from("pinned_posts")
    .select("post_id")
    .eq("user_id", user.id)
    .eq("post_id", postId)
    .maybeSingle();

  if (existing) {
    await supabase.from("pinned_posts").delete().eq("user_id", user.id).eq("post_id", postId);
  } else {
    const { count } = await supabase
      .from("pinned_posts")
      .select("post_id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) >= MAX_PINNED) return;

    await supabase
      .from("pinned_posts")
      .insert({ user_id: user.id, post_id: postId, position: count ?? 0 });
  }

  await revalidateProfileById(supabase, user.id);
  revalidatePath(`/post/${postId}`);
}

/** Club owners write their own info panel. */
export async function updateClubInfo(
  _prev: ModuleFormState,
  formData: FormData
): Promise<ModuleFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const clubId = String(formData.get("club_id") ?? "");
  if (!clubId) return { error: "Unknown club." };

  const { data: club } = await supabase
    .from("clubs")
    .select("created_by")
    .eq("id", clubId)
    .maybeSingle();
  if (!club || club.created_by !== user.id) return { error: "That isn't your club." };

  const body = String(formData.get("info_body") ?? "").trim().slice(0, 4000) || null;
  if (body) {
    const safety = checkBioSafety(body);
    if (!safety.allowed) return { error: safety.reason };
  }

  const { error } = await supabase
    .from("clubs")
    .update({ info_body: body, info_updated_at: new Date().toISOString() })
    .eq("id", clubId);
  if (error) return { error: error.message };

  revalidatePath(`/clubs/${clubId}`);
  return { ok: true };
}
