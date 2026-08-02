"use server";

import { createClient } from "@/lib/supabase/server";
import { checkChatSafety } from "@/lib/contentSafety";

export type ChatSendResult = { error?: string };

export async function sendChatMessage(body: string, clubId: string | null): Promise<ChatSendResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to chat." };

  const trimmed = body.trim();
  if (!trimmed) return { error: "Message can't be empty." };

  const safety = checkChatSafety(trimmed);
  if (!safety.allowed) return { error: safety.reason };

  const { error } = await supabase.from("chat_messages").insert({
    user_id: user.id,
    body: trimmed,
    club_id: clubId,
  });
  if (error) return { error: "Couldn't send that message - you may be blocked." };
  return {};
}
