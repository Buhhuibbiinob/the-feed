"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/events";
import { currentPrompt, MAX_ANSWER_NOTE, weekStart } from "@/lib/weeklyPrompt";
import { friendlyDbError } from "@/lib/dbError";

export type WeeklyState = { error?: string; ok?: boolean };

/**
 * Saves this week's answer, or replaces it.
 *
 * Only ever writes the CURRENT week, computed on the server. The week is
 * not taken from the form: a posted week would let someone fill in a
 * past week long after everyone else had moved on, which turns a shared
 * question into a backfill exercise.
 */
export async function answerWeekly(
  _prev: WeeklyState,
  formData: FormData
): Promise<WeeklyState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const title = String(formData.get("title") ?? "").trim().slice(0, 160);
  if (!title) return { error: "Say what you're picking." };

  const subtitle = String(formData.get("subtitle") ?? "").trim().slice(0, 160) || null;
  const note = String(formData.get("note") ?? "").trim().slice(0, MAX_ANSWER_NOTE) || null;

  const { prompt, week } = currentPrompt();

  // Upsert on the unique pair, so answering twice edits rather than
  // failing on the constraint.
  const { error } = await supabase
    .from("weekly_answers")
    .upsert(
      { user_id: user.id, week_start: week, prompt_id: prompt.id, title, subtitle, note },
      { onConflict: "user_id,week_start" }
    );
  if (error) return { error: friendlyDbError(error.message) };

  await logEvent(supabase, user.id, "weekly_answer", prompt.id);
  revalidatePath("/weekly");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.username) revalidatePath(`/profile/${profile.username}`);

  return { ok: true };
}

export async function deleteWeeklyAnswer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("weekly_answers")
    .delete()
    .eq("user_id", user.id)
    .eq("week_start", weekStart());
  revalidatePath("/weekly");
}
