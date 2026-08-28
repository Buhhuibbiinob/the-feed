"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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

  // Piggy-backed on the view ping rather than written on every request:
  // "last online" only needs to be roughly right, and a write per page load
  // to keep it exact would be the most expensive thing on the site.
  await supabase
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", user.id);
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

  await supabase
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", user.id);

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
