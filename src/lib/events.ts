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
  // Which homepage layout a member was served. Logged once a day rather
  // than once a visit: the analysis needs to know their bucket, not how
  // many times they refreshed.
  "layout_view",
  // A direct message that couldn't be delivered. The spec asks for real
  // block/failure rates before anyone redesigns messaging, and there is
  // no way to know them without recording the failures.
  "dm_failed",
  // Answering the week's question. The point of the weekly prompt is
  // that it gets people who would not otherwise post to post, so how
  // many people answer each week is the number that says whether it
  // works.
  "weekly_answer",
  // Polls are the cheapest thing anyone can do here, so the ratio of
  // votes to polls created is the number that says whether "low effort"
  // actually landed.
  "poll_created",
  "poll_vote",
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

/**
 * Logs an event at most once per member per day.
 *
 * For things like "which layout did they see", a row per page load buries
 * the events that actually matter under thousands of duplicates.
 */
export async function logEventDaily(
  supabase: SupabaseClient,
  userId: string,
  kind: EventKind,
  detail?: string
): Promise<void> {
  try {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);

    const { count } = await supabase
      .from("activity_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("kind", kind)
      .gte("created_at", since.toISOString());

    if ((count ?? 0) > 0) return;
    await logEvent(supabase, userId, kind, detail);
  } catch {
    // Same as logEvent: analytics must never break the page.
  }
}
