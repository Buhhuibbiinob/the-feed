"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { MAX_BODY, MAX_BUTTON_LABEL, MAX_TITLE } from "@/lib/announcements";

// Writing and closing announcements.
//
// The database is the real gate here - the policies on `announcements`
// already refuse an insert from anybody without is_admin, so a request
// forged past this file still gets nothing. The check below is so that an
// admin who has been demoted sees "Not authorized" instead of a Postgres
// error, not because it is the only thing standing there.

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) {
    throw new Error("Not authorized.");
  }
  return { supabase, userId: user.id };
}

function trimmed(formData: FormData, key: string, max: number): string {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

/** An empty datetime-local field is "no bound", not the epoch. */
function timestampOrNull(formData: FormData, key: string): string | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const at = new Date(raw);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

export async function createAnnouncement(formData: FormData) {
  const { supabase, userId } = await requireAdmin();

  const title = trimmed(formData, "title", MAX_TITLE);
  if (!title) return;

  const style = String(formData.get("style") ?? "alert") === "banner" ? "banner" : "alert";
  const linkUrl = trimmed(formData, "link_url", 500);

  await supabase.from("announcements").insert({
    title,
    body: trimmed(formData, "body", MAX_BODY),
    style,
    // A label with no url would render a button that goes nowhere, so
    // the pair travels together or not at all.
    button_label: linkUrl ? trimmed(formData, "button_label", MAX_BUTTON_LABEL) || null : null,
    link_url: linkUrl || null,
    starts_at: timestampOrNull(formData, "starts_at"),
    ends_at: timestampOrNull(formData, "ends_at"),
    created_by: userId,
  });

  // Every page renders the announcement, so every page is stale now.
  revalidatePath("/", "layout");
}

export async function setAnnouncementActive(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("announcement_id") ?? "");
  if (!id) return;

  await supabase
    .from("announcements")
    .update({ active: String(formData.get("active") ?? "") === "1" })
    .eq("id", id);
  revalidatePath("/", "layout");
}

export async function deleteAnnouncement(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("announcement_id") ?? "");
  if (!id) return;

  await supabase.from("announcements").delete().eq("id", id);
  revalidatePath("/", "layout");
}

/**
 * "I've read it."
 *
 * Deliberately quiet: it returns rather than throws when nobody is
 * signed in, because a signed-out visitor closing an alert is a perfectly
 * ordinary thing to do - the browser remembers that one locally and the
 * server has nothing to store. Closing the alert must never be the thing
 * that shows somebody an error.
 */
export async function dismissAnnouncement(announcementId: string) {
  if (!announcementId) return;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("announcement_dismissals")
      .upsert(
        { announcement_id: announcementId, user_id: user.id },
        { onConflict: "announcement_id,user_id" }
      );
  } catch {
    // The local copy has already hidden it. A failure here means it
    // comes back on another device, which beats an error toast.
  }
}
