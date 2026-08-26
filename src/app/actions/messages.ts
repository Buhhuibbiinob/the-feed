"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkMessageSafety } from "@/lib/contentSafety";
import { logEvent } from "@/lib/events";

export type MessageFormState = {
  error?: string;
  ok?: boolean;
};

export async function sendMessage(
  _prevState: MessageFormState,
  formData: FormData
): Promise<MessageFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to send a message." };
  }

  const recipientId = String(formData.get("recipient_id") ?? "");
  const recipientUsername = String(formData.get("recipient_username") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!recipientId || !body) {
    return { error: "Message can't be empty." };
  }
  if (recipientId === user.id) {
    return { error: "You can't message yourself." };
  }

  const safety = checkMessageSafety(body);
  if (!safety.allowed) {
    return { error: safety.reason };
  }

  const { error } = await supabase.from("direct_messages").insert({
    sender_id: user.id,
    recipient_id: recipientId,
    body,
  });

  if (error) {
    // Recorded so the block/failure rate is a number rather than a guess.
    // The only thing that can reject a send today is the block list, so a
    // rise here means blocking, not a policy nobody can see.
    await logEvent(supabase, user.id, "dm_failed", "insert_rejected");
    return { error: "Couldn't send that message - you may be blocked by this user." };
  }

  revalidatePath(`/messages/${recipientUsername}`);
  revalidatePath("/messages");
  return { ok: true };
}
