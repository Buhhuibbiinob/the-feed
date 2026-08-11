"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { isValidTheme } from "@/lib/themes";
import { EDITABLE_TOKENS, isSafeTokenValue } from "@/lib/themeTokens";

export type ThemeTokenState = { error?: string; ok?: boolean; summary?: string };

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, admin: false };
  return { supabase, admin: await isAdmin(supabase, user.id) };
}

/**
 * Saves one theme's token overrides. A blank field means "no override", which
 * is a delete rather than an empty string - otherwise the theme would be
 * overridden with nothing and the property would break.
 */
export async function saveThemeTokens(
  _prev: ThemeTokenState,
  formData: FormData
): Promise<ThemeTokenState> {
  const { supabase, admin } = await requireAdmin();
  if (!admin) return { error: "Admins only." };

  const theme = String(formData.get("theme") ?? "");
  if (!isValidTheme(theme)) return { error: "Unknown theme." };

  const upserts: { theme: string; token: string; value: string }[] = [];
  const clears: string[] = [];
  const rejected: string[] = [];

  for (const token of EDITABLE_TOKENS) {
    const raw = formData.get(token);
    if (raw === null) continue;
    const value = String(raw).trim();

    if (!value) {
      clears.push(token);
      continue;
    }
    if (!isSafeTokenValue(value)) {
      rejected.push(token);
      continue;
    }
    upserts.push({ theme, token, value });
  }

  if (clears.length) {
    const { error } = await supabase
      .from("site_theme_tokens")
      .delete()
      .eq("theme", theme)
      .in("token", clears);
    if (error) return { error: error.message };
  }

  if (upserts.length) {
    const { error } = await supabase
      .from("site_theme_tokens")
      .upsert(upserts, { onConflict: "theme,token" });
    if (error) return { error: error.message };
  }

  revalidatePath("/", "layout");
  revalidatePath("/admin/themes");

  const saved = `Saved ${upserts.length} override${upserts.length === 1 ? "" : "s"} for ${theme}.`;
  return {
    ok: true,
    summary: rejected.length
      ? `${saved} Refused ${rejected.length} value${rejected.length === 1 ? "" : "s"}: ${rejected.join(", ")}.`
      : saved,
  };
}

/** Drops every override for one theme, putting it back to the stylesheet. */
export async function resetThemeTokens(formData: FormData) {
  const { supabase, admin } = await requireAdmin();
  if (!admin) return;

  const theme = String(formData.get("theme") ?? "");
  if (!isValidTheme(theme)) return;

  await supabase.from("site_theme_tokens").delete().eq("theme", theme);

  revalidatePath("/", "layout");
  revalidatePath("/admin/themes");
}
