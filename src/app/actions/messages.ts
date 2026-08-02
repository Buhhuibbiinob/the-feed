"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkMessageSafety } from "@/lib/contentSafety";

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
    return { error: "Couldn't send that message - you may be blocked by this user." };
  }

  revalidatePath(`/messages/${recipientUsername}`);
  revalidatePath("/messages");
  return { ok: true };
}
