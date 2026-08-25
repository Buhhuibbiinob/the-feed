"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isPickReaction } from "@/lib/reactions";
import { refreshTasteTwin, twinIsStale } from "@/lib/tasteTwin";

// Profile-activity writes: the things that happen *to* a profile while its
// owner isn't looking. Kept out of actions/profile.ts, which is the owner
// editing their own page.

/**
 * Records that the signed-in member looked at someone's profile.
 *
 * Called from the client rather than during the page render on purpose:
 * Next prefetches route payloads on link hover, so a render-time write
 * would count profile views for people who only ever pointed at the link.
 *
 * The row is keyed on (profile, viewer, date), so repeat visits the same
 * day collapse into one and the owner's count means distinct people.
 */
export async function recordProfileView(profileId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id === profileId) return;

  await supabase
    .from("profile_views")
    .upsert(
      { profile_id: profileId, viewer_id: user.id },
      { onConflict: "profile_id,viewer_id,view_date", ignoreDuplicates: true }
    );
}

/**
 * Recomputes the caller's taste twin if the cached one has gone stale.
 * Only ever runs for the signed-in member against their own profile, so a
 * popular profile can't be used to trigger the expensive scan repeatedly.
 */
export async function refreshOwnTasteTwin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("taste_twin_at, username")
    .eq("id", user.id)
    .maybeSingle();

  if (!twinIsStale(profile?.taste_twin_at)) return;

  await refreshTasteTwin(supabase, user.id);
  if (profile?.username) revalidatePath(`/profile/${profile.username}`);
}

/** Marks the current twin as announced, so the callout stops nagging. */
export async function acknowledgeTasteTwin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("taste_twin_id, username")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return;

  await supabase
    .from("profiles")
    .update({ taste_twin_announced_id: profile.taste_twin_id })
    .eq("id", user.id);

  if (profile.username) revalidatePath(`/profile/${profile.username}`);
}

/**
 * Adds, changes or clears the caller's reaction to one of someone's
 * top-list picks. Tapping the reaction you already left removes it, which
 * is what every reaction row anyone has used already does.
 */
export async function reactToPick(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const favoriteId = String(formData.get("favorite_id") ?? "");
  const emoji = formData.get("emoji");
  if (!favoriteId || !isPickReaction(emoji)) return;

  // The pick's owner is read from the row rather than trusted from the
  // form: the client says which pick, the server decides whose it is.
  const { data: favorite } = await supabase
    .from("profile_favorites")
    .select("user_id")
    .eq("id", favoriteId)
    .maybeSingle();
  if (!favorite || favorite.user_id === user.id) return;

  const { data: existing } = await supabase
    .from("favorite_reactions")
    .select("emoji")
    .eq("favorite_id", favoriteId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.emoji === emoji) {
    await supabase
      .from("favorite_reactions")
      .delete()
      .eq("favorite_id", favoriteId)
      .eq("user_id", user.id);
  } else {
    await supabase
      .from("favorite_reactions")
      .upsert({ favorite_id: favoriteId, user_id: user.id, emoji }, { onConflict: "favorite_id,user_id" });
  }

  const { data: owner } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", favorite.user_id)
    .maybeSingle();
  if (owner?.username) revalidatePath(`/profile/${owner.username}`);
}
