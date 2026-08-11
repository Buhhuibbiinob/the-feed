"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { isValidTheme } from "@/lib/themes";
import { EDITABLE_TOKENS, isSafeTokenValue } from "@/lib/themeTokens";
import { SITE_THEME_KEY, SITE_THEME_FORCED_KEY } from "@/lib/siteSettings";
import { isImageFile, guessContentType, megabytes, MAX_BACKGROUND_BYTES } from "@/lib/uploads";

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

/** Sets (or clears) the theme everyone on the site gets. */
export async function setSiteTheme(formData: FormData) {
  const { supabase, admin } = await requireAdmin();
  if (!admin) return;

  const theme = String(formData.get("theme") ?? "");
  const forced = formData.get("forced") === "true";

  if (!theme) {
    await supabase.from("site_settings").delete().in("key", [SITE_THEME_KEY, SITE_THEME_FORCED_KEY]);
  } else {
    if (!isValidTheme(theme)) return;
    await supabase.from("site_settings").upsert(
      [
        { key: SITE_THEME_KEY, value: theme },
        { key: SITE_THEME_FORCED_KEY, value: forced ? "true" : "false" },
      ],
      { onConflict: "key" }
    );
  }

  revalidatePath("/", "layout");
  revalidatePath("/admin/themes");
}

/**
 * Uploads a background image for one theme and stores it as that theme's
 * --body-image token.
 *
 * This is the only path that may write a url() into a token. Free-text
 * token values still refuse url() outright, because there the URL would be
 * whatever an admin pasted; here it's a link this server just produced
 * from its own storage bucket, so there's nothing to smuggle.
 */
export async function uploadThemeBackground(
  _prev: ThemeTokenState,
  formData: FormData
): Promise<ThemeTokenState> {
  const { supabase, admin } = await requireAdmin();
  if (!admin) return { error: "Admins only." };

  const theme = String(formData.get("theme") ?? "");
  if (!isValidTheme(theme)) return { error: "Unknown theme." };

  const file = formData.get("background_file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image file." };
  if (!isImageFile(file)) return { error: "File must be an image." };
  if (file.size > MAX_BACKGROUND_BYTES) {
    return { error: `Image must be under ${megabytes(MAX_BACKGROUND_BYTES)}MB.` };
  }

  const ext = file.name.split(".").pop() || "jpg";
  const path = `themes/${theme}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: guessContentType(file) });
  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  // Cache-bust so replacing the image actually shows the new one.
  const value = `url("${publicUrl}?v=${Date.now()}") center / cover no-repeat fixed`;

  const { error } = await supabase
    .from("site_theme_tokens")
    .upsert({ theme, token: "--body-image", value }, { onConflict: "theme,token" });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  revalidatePath("/admin/themes");
  return { ok: true, summary: "Background uploaded." };
}

/** Drops a theme's uploaded background, back to its built-in one. */
export async function clearThemeBackground(formData: FormData) {
  const { supabase, admin } = await requireAdmin();
  if (!admin) return;

  const theme = String(formData.get("theme") ?? "");
  if (!isValidTheme(theme)) return;

  await supabase
    .from("site_theme_tokens")
    .delete()
    .eq("theme", theme)
    .eq("token", "--body-image");

  revalidatePath("/", "layout");
  revalidatePath("/admin/themes");
}
