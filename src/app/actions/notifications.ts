"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_EMAIL_PREFS,
  EMAIL_EVENTS,
  NUDGE_PREF_KEY,
  isEmailMode,
} from "@/lib/emailPrefs";

export async function markNotificationsSeen() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({ notifications_seen_at: new Date().toISOString() })
    .eq("id", user.id);
}

export type EmailPrefsState = { error?: string; ok?: boolean };

export async function updateEmailPrefs(
  _prevState: EmailPrefsState,
  formData: FormData
): Promise<EmailPrefsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // Built from the app's own event list rather than from whatever keys the
  // form posted, so an unexpected field can't end up stored as a pref.
  const prefs: Record<string, string> = {};
  for (const event of EMAIL_EVENTS) {
    const value = formData.get(event.key);
    prefs[event.key] = isEmailMode(value) ? value : DEFAULT_EMAIL_PREFS[event.key];
  }
  // The nudge is on or off rather than off/digest/instant, and it is
  // written every save: this blob is rebuilt from scratch, so a key left
  // out here is a key silently reset to its default.
  prefs[NUDGE_PREF_KEY] = formData.get(NUDGE_PREF_KEY) === "on" ? "on" : "off";

  const { error } = await supabase.from("profiles").update({ email_prefs: prefs }).eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { ok: true };
}
