import type { SupabaseClient } from "@supabase/supabase-js";

// The instrumentation the roadmap asks for, in one place.
//
// Events are logged best-effort: a failed insert must never take down the
// thing the member was actually doing. Analytics that breaks the product it
// measures stops being worth having.

export const EVENT_KINDS = [
  "profile_edit",
  "review_posted",
  "profile_view",
  "signup",
] as const;

export type EventKind = (typeof EVENT_KINDS)[number];

/**
 * `detail` distinguishes flavours of the same event - which part of the
 * profile was edited, say - so "profile edits over time" can be split into
 * one-time setup versus repeat tweaking without a column per control.
 */
export async function logEvent(
  supabase: SupabaseClient,
  userId: string,
  kind: EventKind,
  detail?: string
): Promise<void> {
  try {
    await supabase.from("activity_events").insert({
      user_id: userId,
      kind,
      meta: detail ? { detail } : null,
    });
  } catch {
    // Intentionally swallowed - see the note above.
  }
}
