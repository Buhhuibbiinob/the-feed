"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function reportMessage(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const messageId = String(formData.get("message_id") ?? "");
  if (!messageId) return;

  await supabase.from("message_reports").insert({ message_id: messageId, reporter_id: user.id });
  revalidatePath("/admin");
}

export async function blockUser(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const blockedId = String(formData.get("blocked_id") ?? "");
  if (!blockedId || blockedId === user.id) return;

  await supabase.from("blocked_users").insert({ blocker_id: user.id, blocked_id: blockedId });
  revalidatePath("/chat");
}

export async function unblockUser(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const blockedId = String(formData.get("blocked_id") ?? "");
  if (!blockedId) return;

  await supabase.from("blocked_users").delete().eq("blocker_id", user.id).eq("blocked_id", blockedId);
  revalidatePath("/chat");
}

export async function deleteOwnMessage(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const messageId = String(formData.get("message_id") ?? "");
  if (!messageId) return;

  await supabase.from("chat_messages").delete().eq("id", messageId).eq("user_id", user.id);
  revalidatePath("/chat");
}
