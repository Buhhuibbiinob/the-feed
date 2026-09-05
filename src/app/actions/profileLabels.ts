"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import {
  cleanProfileLabel,
  defaultProfileLabels,
  profileLabelKey,
  type ProfileLabelKey,
} from "@/lib/profileLabels";

export type LabelFormState = { error?: string; ok?: boolean };

/** Renames one piece of profile wording, or restores the shipped word. */
export async function setProfileLabel(
  _prev: LabelFormState,
  formData: FormData
): Promise<LabelFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) return { error: "Not authorized." };

  const key = String(formData.get("key") ?? "") as ProfileLabelKey;
  const defaults = defaultProfileLabels();
  if (!(key in defaults)) return { error: "Unknown label." };

  const value = cleanProfileLabel(formData.get("value"));

  // Storing a row that repeats the shipped word would leave a stale copy
  // behind the next time that word changes in the code.
  const { error } =
    !value || value === defaults[key]
      ? await supabase.from("site_settings").delete().eq("key", profileLabelKey(key))
      : await supabase
          .from("site_settings")
          .upsert([{ key: profileLabelKey(key), value }], { onConflict: "key" });

  if (error) return { error: error.message };

  // Profiles are rendered everywhere, so the whole tree is stale.
  revalidatePath("/", "layout");
  return { ok: true };
}
