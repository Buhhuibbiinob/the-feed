import type { SupabaseClient } from "@supabase/supabase-js";

// The CSS custom properties an admin can retune from /admin/themes. Only
// these are writable: the editor is a list of known knobs, not a free-text
// stylesheet, so a bad value can never do more than make one property look
// wrong (and "Reset" puts it back).
export type ThemeTokenGroup = {
  label: string;
  hint: string;
  tokens: { name: string; label: string; placeholder: string }[];
};

export const THEME_TOKEN_GROUPS: ThemeTokenGroup[] = [
  {
    label: "Layout",
    hint: "Arrangement of the page itself. Sidebar side, width, gutters.",
    tokens: [
      { name: "--content-direction", label: "Sidebar side", placeholder: "row (right) or row-reverse (left)" },
      { name: "--sidebar-width", label: "Sidebar width", placeholder: "300px" },
      { name: "--content-gap", label: "Column gutter", placeholder: "18px" },
      { name: "--wrap-max", label: "Page max width", placeholder: "1240px" },
    ],
  },
  {
    label: "Type",
    hint: "Display face and the heading treatment.",
    tokens: [
      { name: "--font-family", label: "Body font stack", placeholder: "Arial, Helvetica, sans-serif" },
      { name: "--font-display", label: "Display font stack", placeholder: "Impact, sans-serif" },
      { name: "--hero-size", label: "Page heading size", placeholder: "40px" },
      { name: "--hero-weight", label: "Page heading weight", placeholder: "800" },
      { name: "--hero-spacing", label: "Page heading tracking", placeholder: "-0.4px" },
      { name: "--hero-transform", label: "Page heading case", placeholder: "none / uppercase / lowercase" },
    ],
  },
  {
    label: "Background",
    hint: "Base gradient, plus a texture layer drawn over it.",
    tokens: [
      { name: "--body-bg", label: "Page background", placeholder: "linear-gradient(160deg, #000, #003)" },
      { name: "--body-texture", label: "Background texture", placeholder: "repeating-linear-gradient(...)" },
      { name: "--body-glyph-color", label: "Watermark glyph colour", placeholder: "rgba(255,255,255,0.05)" },
    ],
  },
  {
    label: "Panels",
    hint: "Shape and weight of every card on the site.",
    tokens: [
      { name: "--panel-radius", label: "Corner radius", placeholder: "9px" },
      { name: "--panel-frame", label: "Border colour", placeholder: "#0055cc" },
      { name: "--panel-shadow", label: "Shadow", placeholder: "0 14px 28px rgba(0,0,0,0.28)" },
      { name: "--panel-texture", label: "Body texture", placeholder: "repeating-linear-gradient(...)" },
      { name: "--panel-body-bg", label: "Body background", placeholder: "#ffffff" },
      { name: "--panel-head-bg", label: "Header background", placeholder: "linear-gradient(180deg, #eee, #ccc)" },
      { name: "--panel-head-text", label: "Header text colour", placeholder: "#1e1e1e" },
    ],
  },
  {
    label: "Navigation",
    hint: "The bar across the top.",
    tokens: [
      { name: "--nav-bg", label: "Background", placeholder: "linear-gradient(180deg, #000, #001a4d)" },
      { name: "--nav-texture", label: "Texture", placeholder: "repeating-linear-gradient(...)" },
      { name: "--nav-seam", label: "Bottom seam colour", placeholder: "#0066ff" },
      { name: "--nav-shadow", label: "Shadow", placeholder: "0 2px 6px rgba(0,0,0,0.25)" },
      { name: "--nav-text", label: "Text colour", placeholder: "#ffffff" },
    ],
  },
  {
    label: "Buttons",
    hint: "Primary and secondary button treatment.",
    tokens: [
      { name: "--btn-image", label: "Background", placeholder: "linear-gradient(180deg, #8fc2ff, #1d4f9e)" },
      { name: "--btn-border", label: "Border colour", placeholder: "#16407f" },
      { name: "--btn-text", label: "Label colour", placeholder: "#ffffff" },
      { name: "--btn-radius", label: "Corner radius", placeholder: "999px" },
      { name: "--btn-shadow", label: "Shadow", placeholder: "0 4px 10px rgba(0,0,0,0.35)" },
    ],
  },
  {
    label: "Detail",
    hint: "Stars, artwork frames, list stripes, accents.",
    tokens: [
      { name: "--star-on", label: "Filled star", placeholder: "linear-gradient(180deg, #ffd75e, #f0a800)" },
      { name: "--star-off", label: "Empty star", placeholder: "linear-gradient(180deg, #cfcfcf, #9a9a9a)" },
      { name: "--art-frame", label: "Artwork frame", placeholder: "3px solid #fff" },
      { name: "--row-stripe", label: "List row stripe", placeholder: "rgba(0,0,0,0.03)" },
      { name: "--like-color", label: "Like colour", placeholder: "#d9345c" },
      { name: "--text", label: "Body text colour", placeholder: "#333333" },
      { name: "--muted", label: "Muted text colour", placeholder: "#666666" },
    ],
  },
];

export const EDITABLE_TOKENS = new Set(
  THEME_TOKEN_GROUPS.flatMap((g) => g.tokens.map((t) => t.name))
);

/**
 * A token value is about to be set as an inline custom property. React hands
 * it to style.setProperty, so it can't break out into markup - but it could
 * still smuggle in a second declaration or pull a remote asset, so both are
 * refused here rather than relied on being harmless.
 */
export function isSafeTokenValue(value: string): boolean {
  if (value.length > 400) return false;
  if (/[;{}<>]/.test(value)) return false;
  if (/@import|expression\s*\(|javascript:/i.test(value)) return false;
  // url() would let a theme token fetch from anywhere the CSP allows; the
  // custom-background feature has its own dedicated, validated field.
  if (/url\s*\(/i.test(value)) return false;
  return true;
}

export type ThemeTokenRow = { theme: string; token: string; value: string };

/** Overrides for one theme, as a style object ready to spread onto <html>. */
export async function getThemeTokenOverrides(
  supabase: SupabaseClient,
  theme: string
): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("site_theme_tokens")
    .select("token, value")
    .eq("theme", theme);

  // The table only exists once the migration has been run. A missing table
  // means "no overrides", not a broken page.
  if (error) return {};

  const style: Record<string, string> = {};
  for (const row of data ?? []) {
    const token = String(row.token);
    const value = String(row.value);
    if (EDITABLE_TOKENS.has(token) && isSafeTokenValue(value)) style[token] = value;
  }
  return style;
}

/** Every override, grouped by theme, for the admin editor. */
export async function getAllThemeTokens(
  supabase: SupabaseClient
): Promise<Map<string, Map<string, string>>> {
  const { data, error } = await supabase.from("site_theme_tokens").select("theme, token, value");
  const byTheme = new Map<string, Map<string, string>>();
  if (error) return byTheme;

  for (const row of (data ?? []) as ThemeTokenRow[]) {
    if (!byTheme.has(row.theme)) byTheme.set(row.theme, new Map());
    byTheme.get(row.theme)!.set(row.token, row.value);
  }
  return byTheme;
}
