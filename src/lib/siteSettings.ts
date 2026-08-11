import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidTheme } from "@/lib/themes";

export const SITE_THEME_KEY = "site_theme";
export const SITE_THEME_FORCED_KEY = "site_theme_forced";

export type SiteThemeSetting = {
  /** Theme id an admin has chosen for the site, or null if they haven't. */
  theme: string | null;
  /** true = everyone sees it and the personal picker is overridden.
   *  false = it's only the starting point for people who haven't chosen. */
  forced: boolean;
};

/**
 * The site-wide theme choice. Returns the "no opinion" answer when the
 * table hasn't been created yet, so a site that hasn't run the migration
 * behaves exactly as it did before rather than erroring.
 */
export async function getSiteTheme(supabase: SupabaseClient): Promise<SiteThemeSetting> {
  const { data, error } = await supabase
    .from("site_settings")
    .select("key, value")
    .in("key", [SITE_THEME_KEY, SITE_THEME_FORCED_KEY]);

  if (error) return { theme: null, forced: false };

  const rows = new Map((data ?? []).map((r) => [String(r.key), String(r.value)]));
  const theme = rows.get(SITE_THEME_KEY);
  return {
    theme: isValidTheme(theme) ? theme : null,
    forced: rows.get(SITE_THEME_FORCED_KEY) === "true",
  };
}

/**
 * Which theme to render for one visitor.
 * Forced beats everything. Otherwise a person's own pick wins, and the
 * site theme is only the fallback for people who have never chosen.
 */
export function resolveTheme(
  site: SiteThemeSetting,
  personal: string | null | undefined,
  fallback: string
): string {
  if (site.forced && site.theme) return site.theme;
  if (isValidTheme(personal)) return personal;
  return site.theme ?? fallback;
}
