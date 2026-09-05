import type { SupabaseClient } from "@supabase/supabase-js";
import { THEMES } from "@/lib/themes";

// What each theme is CALLED, which is the site owner's business rather
// than this codebase's.
//
// The five themes ship as "The 70s" through "The 2010s" because those are
// the honest labels for what they look like, but the names are the most
// personal thing about a theme picker and they cost nothing to change.
// So they live in site_settings - the key/value table the site theme
// already uses - under `theme_name:<id>`. No new table, no migration.
//
// An override is only ever a display string. It cannot change which theme
// a profile is on, because the id in the database never moves.

export const MAX_THEME_NAME = 24;

export function themeNameKey(themeId: string): string {
  return `theme_name:${themeId}`;
}

/** The name shipped with a theme, before any override. */
export function defaultThemeName(themeId: string): string {
  return THEMES.find((t) => t.id === themeId)?.label ?? themeId;
}

/**
 * A name is valid if it is a name: something on one line, short enough to
 * sit in a swatch, and not blank. Blank is not an error - it means "put
 * the shipped name back" - so it is handled by the caller, not here.
 */
export function cleanThemeName(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_THEME_NAME);
}

/**
 * Every theme's live name.
 *
 * Falls back to the shipped names on any failure, including the table not
 * existing. A theme picker with no labels is a row of unexplained
 * rectangles, so this must never return nothing.
 */
export async function getThemeNames(supabase: SupabaseClient): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  for (const t of THEMES) names[t.id] = t.label;

  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", THEMES.map((t) => themeNameKey(t.id)));
    if (error || !data) return names;

    for (const row of data) {
      const id = String(row.key).slice("theme_name:".length);
      const value = cleanThemeName(row.value);
      if (value && id in names) names[id] = value;
    }
  } catch {
    /* shipped names it is */
  }
  return names;
}
