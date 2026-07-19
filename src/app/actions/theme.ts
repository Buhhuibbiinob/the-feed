"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidTheme } from "@/lib/themes";

export type ThemeFormState = {
  error?: string;
  ok?: boolean;
};

export async function updateTheme(
  _prevState: ThemeFormState,
  formData: FormData
): Promise<ThemeFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const theme = String(formData.get("theme") ?? "");
  if (!isValidTheme(theme)) return { error: "Invalid theme." };

  const { error } = await supabase.from("profiles").update({ theme }).eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
