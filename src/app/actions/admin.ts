"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) {
    throw new Error("Not authorized.");
  }
  return supabase;
}

export async function adminDeleteMessage(formData: FormData) {
  const supabase = await requireAdmin();
  const messageId = String(formData.get("message_id") ?? "");
  if (!messageId) return;

  await supabase.from("chat_messages").delete().eq("id", messageId);
  revalidatePath("/admin");
  revalidatePath("/chat");
}

export async function adminDismissReport(formData: FormData) {
  const supabase = await requireAdmin();
  const reportId = String(formData.get("report_id") ?? "");
  if (!reportId) return;

  await supabase.from("message_reports").delete().eq("id", reportId);
  revalidatePath("/admin");
}

export async function adminBanUser(formData: FormData) {
  const supabase = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return;

  await supabase.from("profiles").update({ banned: true }).eq("id", userId);
  revalidatePath("/admin");
}

export async function adminUnbanUser(formData: FormData) {
  const supabase = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return;

  await supabase.from("profiles").update({ banned: false }).eq("id", userId);
  revalidatePath("/admin");
}

export async function adminRemoveUser(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return;

  const adminClient = createAdminClient();
  await adminClient.auth.admin.deleteUser(userId);
  revalidatePath("/admin");
}
