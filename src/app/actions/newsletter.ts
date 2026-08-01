"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { NEWSLETTER_SECTIONS, getIssueById, renderIssueHtml } from "@/lib/newsletter";
import { sendBulkEmail } from "@/lib/email";

export type NewsletterFormState = { error?: string; ok?: boolean };
export type NewsletterSendState = { error?: string; ok?: boolean; sent?: number };

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, admin: false };
  const admin = await isAdmin(supabase, user.id);
  return { supabase, user, admin };
}

export async function createNewsletterIssue() {
  const { supabase, user, admin } = await requireAdmin();
  if (!user || !admin) redirect("/");

  const { data, error } = await supabase
    .from("newsletter_issues")
    .insert({ created_by: user.id })
    .select("id")
    .single();

  revalidatePath("/admin/newsletter");
  if (error || !data) redirect("/admin/newsletter");
  redirect(`/admin/newsletter/${data.id}`);
}

export async function updateNewsletterIssue(
  _prevState: NewsletterFormState,
  formData: FormData
): Promise<NewsletterFormState> {
  const { user, admin, supabase } = await requireAdmin();
  if (!user || !admin) return { error: "Admins only." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing issue id." };

  const update: Record<string, string | null> = {
    title: String(formData.get("title") ?? "").trim() || "This Week on Feedback",
    issue_date: String(formData.get("issue_date") ?? "") || new Date().toISOString().slice(0, 10),
  };
  for (const section of NEWSLETTER_SECTIONS) {
    update[section.key] = String(formData.get(section.key) ?? "").trim() || null;
  }

  const { error } = await supabase.from("newsletter_issues").update(update).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/admin/newsletter/${id}`);
  revalidatePath("/newsletter");
  revalidatePath(`/newsletter/${id}`);
  return { ok: true };
}

export async function publishNewsletterIssue(formData: FormData) {
  const { user, admin, supabase } = await requireAdmin();
  if (!user || !admin) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase
    .from("newsletter_issues")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath(`/admin/newsletter/${id}`);
  revalidatePath("/admin/newsletter");
  revalidatePath("/newsletter");
  revalidatePath(`/newsletter/${id}`);
}

export async function unpublishNewsletterIssue(formData: FormData) {
  const { user, admin, supabase } = await requireAdmin();
  if (!user || !admin) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("newsletter_issues").update({ status: "draft" }).eq("id", id);

  revalidatePath(`/admin/newsletter/${id}`);
  revalidatePath("/admin/newsletter");
  revalidatePath("/newsletter");
}

export async function sendNewsletterIssue(
  _prevState: NewsletterSendState,
  formData: FormData
): Promise<NewsletterSendState> {
  const { user, admin, supabase } = await requireAdmin();
  if (!user || !admin) return { error: "Admins only." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing issue id." };

  const issue = await getIssueById(supabase, id);
  if (!issue) return { error: "Issue not found." };

  const { data: subscriberRows } = await supabase.from("waitlist_signups").select("email");
  const emails = (subscriberRows ?? []).map((r) => r.email as string);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://mythefeed.com";
  const html = renderIssueHtml(issue, siteUrl);
  const result = await sendBulkEmail(issue.title, html, emails);

  if (!result.ok) return { error: result.error };
  return { ok: true, sent: result.sent };
}

export async function deleteNewsletterIssue(formData: FormData) {
  const { user, admin, supabase } = await requireAdmin();
  if (!user || !admin) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await supabase.from("newsletter_issues").delete().eq("id", id);
  revalidatePath("/admin/newsletter");
  redirect("/admin/newsletter");
}
