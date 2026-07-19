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

export async function adminApproveClub(formData: FormData) {
  const supabase = await requireAdmin();
  const clubId = String(formData.get("club_id") ?? "");
  if (!clubId) return;

  await supabase.from("clubs").update({ status: "approved" }).eq("id", clubId);
  revalidatePath("/admin");
  revalidatePath("/clubs");
  revalidatePath(`/clubs/${clubId}`);
}

export async function adminBanClub(formData: FormData) {
  const supabase = await requireAdmin();
  const clubId = String(formData.get("club_id") ?? "");
  if (!clubId) return;

  await supabase.from("clubs").update({ status: "banned" }).eq("id", clubId);
  revalidatePath("/admin");
  revalidatePath("/clubs");
  revalidatePath(`/clubs/${clubId}`);
}

export async function adminUnbanClub(formData: FormData) {
  const supabase = await requireAdmin();
  const clubId = String(formData.get("club_id") ?? "");
  if (!clubId) return;

  await supabase.from("clubs").update({ status: "approved" }).eq("id", clubId);
  revalidatePath("/admin");
  revalidatePath("/clubs");
  revalidatePath(`/clubs/${clubId}`);
}

export async function adminDeleteClub(formData: FormData) {
  const supabase = await requireAdmin();
  const clubId = String(formData.get("club_id") ?? "");
  if (!clubId) return;

  await supabase.from("clubs").delete().eq("id", clubId);
  revalidatePath("/admin");
  revalidatePath("/clubs");
}

export async function adminDismissClubReport(formData: FormData) {
  const supabase = await requireAdmin();
  const reportId = String(formData.get("report_id") ?? "");
  if (!reportId) return;

  await supabase.from("club_reports").delete().eq("id", reportId);
  revalidatePath("/admin");
}

export async function adminVerifyArtist(formData: FormData) {
  const supabase = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return;

  await supabase.from("profiles").update({ is_verified_artist: true }).eq("id", userId);
  revalidatePath("/admin");
  revalidatePath("/artists");
}

export async function adminUnverifyArtist(formData: FormData) {
  const supabase = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return;

  await supabase.from("profiles").update({ is_verified_artist: false }).eq("id", userId);
  revalidatePath("/admin");
  revalidatePath("/artists");
}

export async function adminBanArtistPost(formData: FormData) {
  const supabase = await requireAdmin();
  const postId = String(formData.get("post_id") ?? "");
  if (!postId) return;

  await supabase.from("artist_posts").update({ status: "banned" }).eq("id", postId);
  revalidatePath("/admin");
  revalidatePath("/artists");
}

export async function adminUnbanArtistPost(formData: FormData) {
  const supabase = await requireAdmin();
  const postId = String(formData.get("post_id") ?? "");
  if (!postId) return;

  await supabase.from("artist_posts").update({ status: "active" }).eq("id", postId);
  revalidatePath("/admin");
  revalidatePath("/artists");
}

export async function adminDeleteArtistPost(formData: FormData) {
  const supabase = await requireAdmin();
  const postId = String(formData.get("post_id") ?? "");
  if (!postId) return;

  await supabase.from("artist_posts").delete().eq("id", postId);
  revalidatePath("/admin");
  revalidatePath("/artists");
}

export async function adminDismissArtistReport(formData: FormData) {
  const supabase = await requireAdmin();
  const reportId = String(formData.get("report_id") ?? "");
  if (!reportId) return;

  await supabase.from("artist_post_reports").delete().eq("id", reportId);
  revalidatePath("/admin");
}

export async function adminDeleteArtistComment(formData: FormData) {
  const supabase = await requireAdmin();
  const commentId = String(formData.get("comment_id") ?? "");
  const postId = String(formData.get("post_id") ?? "");
  if (!commentId) return;

  await supabase.from("artist_post_comments").delete().eq("id", commentId);
  revalidatePath("/admin");
  if (postId) revalidatePath(`/artists/${postId}`);
}
