"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isMediaType } from "@/lib/media";
import { MAX_POLL_QUESTION, MAX_POLL_TEXT } from "@/lib/polls";
import { friendlyDbError } from "@/lib/dbError";
import { logEvent } from "@/lib/events";

export type PollState = { error?: string; ok?: boolean };

export async function createPoll(_prev: PollState, formData: FormData): Promise<PollState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const mediaType = formData.get("media_type");
  if (!isMediaType(mediaType)) return { error: "Choose a category." };

  const optionA = String(formData.get("option_a") ?? "").trim().slice(0, MAX_POLL_TEXT);
  const optionB = String(formData.get("option_b") ?? "").trim().slice(0, MAX_POLL_TEXT);
  if (!optionA || !optionB) return { error: "Both sides need something to pick between." };
  // A poll between a thing and itself has no answer, and it is an easy
  // slip when you are pasting two titles in.
  if (optionA.toLowerCase() === optionB.toLowerCase()) {
    return { error: "Those are the same. Give people a choice." };
  }

  const { error } = await supabase.from("polls").insert({
    created_by: user.id,
    media_type: mediaType,
    question: String(formData.get("question") ?? "").trim().slice(0, MAX_POLL_QUESTION) || null,
    option_a: optionA,
    option_b: optionB,
    subtitle_a: String(formData.get("subtitle_a") ?? "").trim().slice(0, MAX_POLL_TEXT) || null,
    subtitle_b: String(formData.get("subtitle_b") ?? "").trim().slice(0, MAX_POLL_TEXT) || null,
  });
  if (error) return { error: friendlyDbError(error.message) };

  await logEvent(supabase, user.id, "poll_created", mediaType);
  revalidatePath("/polls");
  return { ok: true };
}

/**
 * One tap. Voting the same side again takes the vote back, so the whole
 * interaction is a toggle and nothing has to explain itself.
 */
export async function votePoll(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const pollId = String(formData.get("poll_id") ?? "");
  const choice = String(formData.get("choice") ?? "");
  const previous = String(formData.get("previous") ?? "");
  if (!pollId || (choice !== "a" && choice !== "b")) return;

  if (previous === choice) {
    await supabase.from("poll_votes").delete().eq("poll_id", pollId).eq("user_id", user.id);
  } else {
    await supabase
      .from("poll_votes")
      .upsert({ poll_id: pollId, user_id: user.id, choice }, { onConflict: "poll_id,user_id" });
    await logEvent(supabase, user.id, "poll_vote", choice);
  }

  revalidatePath("/polls");
}

export async function deletePoll(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const pollId = String(formData.get("poll_id") ?? "");
  if (!pollId) return;
  // RLS is the real boundary; this just avoids a pointless round trip.
  await supabase.from("polls").delete().eq("id", pollId).eq("created_by", user.id);
  revalidatePath("/polls");
}
