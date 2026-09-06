"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError, isMissingSchema } from "@/lib/dbError";
import { cleanNote } from "@/lib/handoffs";

export type HandoffState = { error?: string; ok?: boolean };

/**
 * Hands one review to one person.
 *
 * The note is the feature. A record passed over with nothing said is a
 * link; a record passed over with "this is the one I kept talking about"
 * is a recommendation, and it is the only kind this site cannot generate
 * for itself.
 */
export async function handRecord(
  _prev: HandoffState,
  formData: FormData
): Promise<HandoffState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const postId = String(formData.get("post_id") ?? "").trim();
  const toUserId = String(formData.get("to_user_id") ?? "").trim();
  if (!postId) return { error: "Nothing to hand over." };
  if (!toUserId) return { error: "Pick somebody to give it to." };
  // The database says this too, but a check constraint failure reaches
  // the member as a wall of Postgres.
  if (toUserId === user.id) return { error: "You already have this one." };

  const { error } = await supabase.from("handoffs").insert({
    from_user_id: user.id,
    to_user_id: toUserId,
    post_id: postId,
    note: cleanNote(formData.get("note")),
  });

  // 23505 is the unique index doing its job: they already have it from
  // you. Handing it over twice is forgetting, not an error - and telling
  // somebody off for forgetting is a worse outcome than the record
  // already being where they wanted it.
  if (error && error.code !== "23505") {
    // The table arrives in migration 012. Until that has been run this
    // is the difference between a button that explains itself and one
    // that silently does nothing.
    if (isMissingSchema(error.message)) {
      return { error: "Handing records over isn't set up yet: run migration 012." };
    }
    return { error: friendlyDbError(error.message) };
  }

  revalidatePath("/alerts");
  return { ok: true };
}

/** Marks everything handed to this member as seen, clearing the badge. */
export async function markHandoffsSeen(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("handoffs")
    .update({ seen_at: new Date().toISOString() })
    .eq("to_user_id", user.id)
    .is("seen_at", null);
}

/**
 * "I took it."
 *
 * Separate from seeing it, and the only column here worth counting
 * later: how often somebody's handoffs get taken is the closest thing
 * this site has to knowing whose taste to trust.
 */
export async function keepHandoff(
  _prev: HandoffState,
  formData: FormData
): Promise<HandoffState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const id = String(formData.get("handoff_id") ?? "").trim();
  if (!id) return { error: "Nothing to keep." };

  const { error } = await supabase
    .from("handoffs")
    .update({ kept_at: new Date().toISOString() })
    .eq("id", id)
    // Belt as well as the RLS policy: only the recipient marks it kept,
    // or a "kept" count is something a sender could manufacture.
    .eq("to_user_id", user.id);

  if (error) return { error: friendlyDbError(error.message) };
  revalidatePath("/alerts");
  return { ok: true };
}
