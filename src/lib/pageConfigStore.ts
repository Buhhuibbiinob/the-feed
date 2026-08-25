import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePageConfig, type PageConfig, type SurfaceKind } from "@/lib/pageConfig";
import { EMPTY_PALETTE } from "@/lib/pageTheme";

// Reading and writing a page's config.
//
// page_configs is the single writer. Profiles customised before it existed
// still have their settings in the old profile_* columns, so a profile with
// no config row is synthesised from those instead of coming back blank -
// nobody's existing profile resets itself the day this ships. The first
// save writes a real row and the legacy columns stop being consulted.

type LegacyProfileRow = {
  profile_bg_color: string | null;
  profile_panel_color: string | null;
  profile_text_color: string | null;
  profile_accent_color: string | null;
  profile_layout: string[] | null;
  bio_font: string | null;
};

// The old layout column encoded hidden sections with a leading "-".
// One section was renamed on the way in: "song" is the anthem module now.
const LEGACY_MODULE_MAP: Record<string, string> = { song: "anthem" };

function legacyModules(layout: string[] | null): { id: string; shown: boolean }[] {
  return (layout ?? []).map((raw) => {
    const shown = !raw.startsWith("-");
    const id = shown ? raw : raw.slice(1);
    return { id: LEGACY_MODULE_MAP[id] ?? id, shown };
  });
}

// The old bio font ids and the new font-pair ids overlap only partly.
const LEGACY_FONT_MAP: Record<string, string> = {
  serif: "broadsheet",
  mono: "terminal",
  display: "poster",
  handwriting: "scrapbook",
  rounded: "rounded",
  system: "system",
};

export async function loadPageConfig(
  supabase: SupabaseClient,
  surface: SurfaceKind,
  ownerId: string
): Promise<PageConfig> {
  const { data } = await supabase
    .from("page_configs")
    .select("config")
    .eq("owner_type", surface)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (data?.config) return resolvePageConfig(data.config, surface);

  if (surface === "profile") {
    const { data: legacy } = await supabase
      .from("profiles")
      .select(
        "profile_bg_color, profile_panel_color, profile_text_color, profile_accent_color, profile_layout, bio_font"
      )
      .eq("id", ownerId)
      .maybeSingle();

    const row = (legacy ?? null) as LegacyProfileRow | null;
    if (row) {
      return resolvePageConfig(
        {
          themeId: "none",
          palette: {
            bg: row.profile_bg_color,
            panel: row.profile_panel_color,
            text: row.profile_text_color,
            accent: row.profile_accent_color,
          },
          fontPairId: LEGACY_FONT_MAP[row.bio_font ?? "system"] ?? "system",
          background: { kind: "none", value: null },
          modules: legacyModules(row.profile_layout),
          presets: [],
        },
        surface
      );
    }
  }

  return resolvePageConfig({ palette: EMPTY_PALETTE }, surface);
}

/**
 * Writes a config. RLS decides whether the caller owns this page - the
 * policy checks profile identity and club ownership directly, so a crafted
 * owner_id can't restyle somebody else's page even if this is called with
 * one.
 */
export async function savePageConfig(
  supabase: SupabaseClient,
  surface: SurfaceKind,
  ownerId: string,
  config: PageConfig
): Promise<{ error?: string }> {
  const { error } = await supabase.from("page_configs").upsert(
    {
      owner_type: surface,
      owner_id: ownerId,
      config: config as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_type,owner_id" }
  );
  return error ? { error: error.message } : {};
}
