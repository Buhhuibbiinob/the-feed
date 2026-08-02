import type { SupabaseClient } from "@supabase/supabase-js";

export type SiteFlagKey =
  | "homepage_ads"
  | "homepage_wrapped"
  | "homepage_clubs"
  | "homepage_creators"
  | "homepage_newsletter"
  | "homepage_new_releases";

// Registry of every homepage section an admin can toggle. `defaultEnabled`
// is what a section does if it has no row yet in site_flags (e.g. right
// after this shipped, before anyone's touched the admin toggle).
export const SITE_FLAGS: { key: SiteFlagKey; label: string; defaultEnabled: boolean }[] = [
  { key: "homepage_ads", label: "Artist Spotlight (ad placements)", defaultEnabled: true },
  { key: "homepage_wrapped", label: "Wrapped promo banner", defaultEnabled: false },
  { key: "homepage_clubs", label: "Clubs teaser", defaultEnabled: true },
  { key: "homepage_creators", label: "Underground Creators section", defaultEnabled: true },
  { key: "homepage_newsletter", label: "Newsletter panel", defaultEnabled: true },
  { key: "homepage_new_releases", label: "New Movies & TV strip", defaultEnabled: true },
];

export async function getSiteFlags(supabase: SupabaseClient): Promise<Record<SiteFlagKey, boolean>> {
  const { data } = await supabase.from("site_flags").select("key, enabled");
  const rows = new Map((data ?? []).map((r) => [r.key as string, r.enabled as boolean]));

  const flags = {} as Record<SiteFlagKey, boolean>;
  for (const f of SITE_FLAGS) {
    flags[f.key] = rows.has(f.key) ? rows.get(f.key)! : f.defaultEnabled;
  }
  return flags;
}
