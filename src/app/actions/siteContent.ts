"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { SITE_CONTENT_FIELDS, type SiteContentKey } from "@/lib/siteContent";

export type SiteContentFormState = {
  error?: string;
  ok?: boolean;
};

export async function updateSiteContent(
  _prevState: SiteContentFormState,
  formData: FormData
): Promise<SiteContentFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) return { error: "Not authorized." };

  const key = String(formData.get("key") ?? "");
  const field = SITE_CONTENT_FIELDS.find((f) => f.key === key);
  if (!field) return { error: "Unknown field." };

  const value = String(formData.get("value") ?? "").trim().slice(0, 500);
  if (!value) return { error: "Text can't be empty." };

  const { error } = await supabase
    .from("site_content")
    .upsert({ key: key as SiteContentKey, value, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };

  revalidatePath(field.path);
  revalidatePath("/admin");
  return { ok: true };
}
