"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { checkReviewSafety } from "@/lib/contentSafety";
import { loadBoard, loadStoreSnapshot } from "@/lib/storeData";
import { COUNTDOWN_DAYS, STORE_LAUNCH_KEY } from "@/lib/storeAccess";
import { storeErrorMessage, type BoardReview, type StoreSnapshot } from "@/lib/store";

// Everything the record store writes. Each of these is a thin wrapper:
// the rules - five a day, nothing twice, ownership, launch - are checked
// by the database functions in migration 022, which these call as the
// signed-in member. Nothing here can grant what the database refuses.

export type StoreResult = { ok: true; snapshot: StoreSnapshot; note?: string } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function viewer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, me: null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, is_admin")
    .eq("id", user.id)
    .maybeSingle();
  return {
    supabase,
    user,
    me: { id: user.id, username: (profile?.username as string) ?? null, isAdmin: !!profile?.is_admin },
  };
}

async function after(
  supabase: Awaited<ReturnType<typeof createClient>>,
  me: { id: string; username: string | null; isAdmin: boolean },
  note?: string
): Promise<StoreResult> {
  const snapshot = await loadStoreSnapshot(supabase, me);
  if (!snapshot) return { ok: false, error: "The shop isn't set up yet." };
  return { ok: true, snapshot, note };
}

export async function refreshStore(): Promise<StoreResult> {
  const { supabase, me } = await viewer();
  const snapshot = await loadStoreSnapshot(supabase, me);
  if (!snapshot) return { ok: false, error: "The shop isn't set up yet." };
  return { ok: true, snapshot };
}

export async function addToCrate(itemId: string): Promise<StoreResult> {
  if (!UUID.test(itemId)) return { ok: false, error: storeErrorMessage("STORE_NOT_IN_STOCK") };
  const { supabase, me } = await viewer();
  if (!me) return { ok: false, error: storeErrorMessage("STORE_SIGNED_OUT") };
  const { error } = await supabase.rpc("store_crate_add", { p_item: itemId });
  if (error) return { ok: false, error: storeErrorMessage(error.message) };
  return after(supabase, me);
}

export async function removeFromCrate(itemId: string): Promise<StoreResult> {
  if (!UUID.test(itemId)) return { ok: false, error: storeErrorMessage(null) };
  const { supabase, me } = await viewer();
  if (!me) return { ok: false, error: storeErrorMessage("STORE_SIGNED_OUT") };
  const { error } = await supabase.rpc("store_crate_remove", { p_item: itemId });
  if (error) return { ok: false, error: storeErrorMessage(error.message) };
  return after(supabase, me);
}

export async function checkout(): Promise<StoreResult> {
  const { supabase, me } = await viewer();
  if (!me) return { ok: false, error: storeErrorMessage("STORE_SIGNED_OUT") };
  const { data, error } = await supabase.rpc("store_checkout");
  if (error) return { ok: false, error: storeErrorMessage(error.message) };
  const dropped = Number((data as { dropped?: number } | null)?.dropped ?? 0);
  return after(
    supabase,
    me,
    dropped > 0 ? `${dropped} item${dropped === 1 ? " wasn't" : "s weren't"} on the shelves any more and stayed behind.` : undefined
  );
}

export async function submitStoreReview(
  itemId: string,
  rating: number | null,
  body: string
): Promise<StoreResult> {
  if (!UUID.test(itemId)) return { ok: false, error: storeErrorMessage("STORE_NOT_OWNED") };
  const text = String(body ?? "").trim();
  const stars = rating === null ? null : Math.round(Number(rating));
  if (stars !== null && !(stars >= 1 && stars <= 5)) return { ok: false, error: storeErrorMessage("STORE_BAD_REVIEW") };
  if (!text && stars === null) return { ok: false, error: storeErrorMessage("STORE_BAD_REVIEW") };
  // The same check every review on the site goes through.
  if (text) {
    const safety = checkReviewSafety(text);
    if (!safety.allowed) return { ok: false, error: safety.reason };
  }
  const { supabase, me } = await viewer();
  if (!me) return { ok: false, error: storeErrorMessage("STORE_SIGNED_OUT") };
  const { error } = await supabase.rpc("store_submit_review", {
    p_item: itemId,
    p_rating: stars,
    p_body: text,
  });
  if (error) return { ok: false, error: storeErrorMessage(error.message) };
  // It is an ordinary review too, so the feed and the work page have it.
  revalidatePath("/feed");
  return after(supabase, me);
}

export async function getStoreBoard(): Promise<BoardReview[]> {
  const supabase = await createClient();
  return loadBoard(supabase);
}

// ---------- launch (admins) ----------

export type LaunchResult = { ok: true; launchAt: string | null } | { ok: false; error: string };

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) return null;
  return supabase;
}

/** Starts the public countdown: the store opens to everybody three days from now (UTC). */
export async function startStoreCountdown(): Promise<LaunchResult> {
  const supabase = await requireAdmin();
  if (!supabase) return { ok: false, error: "Only an admin can do that." };
  const launchAt = new Date(Date.now() + COUNTDOWN_DAYS * 86_400_000).toISOString();
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: STORE_LAUNCH_KEY, value: launchAt, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true, launchAt };
}

/** Stops the countdown. The store goes back to admins only; the feed stays the homepage. */
export async function cancelStoreCountdown(): Promise<LaunchResult> {
  const supabase = await requireAdmin();
  if (!supabase) return { ok: false, error: "Only an admin can do that." };
  const { error } = await supabase.from("site_settings").delete().eq("key", STORE_LAUNCH_KEY);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/");
  return { ok: true, launchAt: null };
}
