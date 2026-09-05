// Single source of truth for site themes. Add a new entry here (plus a
// matching `[data-theme="id"]` block in globals.css) to introduce a theme -
// nothing else needs to change to make it selectable in Settings.
//
// Every theme is colors-only (swaps the color/gradient tokens) except
// ios-light, the default, which also carries its own real structural CSS
// (border radius, bevel depth, spacing) in globals.css. Everything else
// shares the site's normal default shapes/spacing so switching themes never
// reshapes anything - only recolors it.
//
// ---- One theme per decade ----
//
// There used to be eighteen of these, named after websites and scenes:
// MySpace, Scene, Frutiger Aero, Party Rock 2010, Swag 2018 and so on.
// They were good looks but they were a list, and a list of eighteen is a
// thing you scroll past rather than choose from - half of them were
// different shades of the same three years, and nobody could tell from
// the names which ones those were.
//
// Five decades instead. Each one has to earn its place by looking
// nothing like its neighbours, which is a much harder brief than
// "another dark one with pink" and produces a much better set.
//
// There is no `description` field on purpose. A theme is a picture; you
// pick it by looking at the swatch, not by reading a sentence about
// glossy chrome. The labels are editable from /admin/themes, so what
// these are CALLED is the site owner's business, not this file's.

export type ThemeCategory = "color";

export type Theme = {
  id: string;
  /** The name shipped with the theme. An admin can override it, so read
   *  the live name through lib/themeNames rather than using this. */
  label: string;
  category: ThemeCategory;
};

export const THEMES: Theme[] = [
  { id: "ios-light", label: "Default", category: "color" },
  { id: "decade-70s", label: "The 70s", category: "color" },
  { id: "decade-80s", label: "The 80s", category: "color" },
  { id: "decade-90s", label: "The 90s", category: "color" },
  { id: "decade-00s", label: "The 2000s", category: "color" },
  { id: "decade-10s", label: "The 2010s", category: "color" },
  { id: "custom", label: "Custom Background", category: "color" },
];

export const THEME_CATEGORIES: { id: ThemeCategory; label: string }[] = [{ id: "color", label: "Colors" }];

export const THEME_IDS = new Set(THEMES.map((t) => t.id));
export const DEFAULT_THEME = "ios-light";

export function isValidTheme(value: string | null | undefined): value is string {
  return !!value && THEME_IDS.has(value);
}

/**
 * Where somebody on a retired theme lands.
 *
 * Eighteen themes went away and thirteen real people were sitting on
 * them. isValidTheme already sends an unknown id to the default, so
 * nothing breaks either way - but "your site turned grey overnight" is a
 * bad morning, and every one of the old themes belonged to an era that
 * one of the five new ones now covers. So they get moved to the decade
 * they were always dressed as.
 *
 * Migration 010 does this in the database. This map is the same thing in
 * code, for any row that migration hasn't reached - a profile restored
 * from a backup, or a site that hasn't run it yet.
 */
export const RETIRED_THEMES: Record<string, string> = {
  // Web 1.0 and the blog era.
  tumblr: "decade-90s",
  // Y2K, bling, and the glossy middle of the decade.
  myspace: "decade-00s",
  mcbling: "decade-00s",
  scene: "decade-00s",
  emo: "decade-00s",
  "frutiger-aero": "decade-00s",
  "champagne-bling": "decade-00s",
  "zebra-bling": "decade-00s",
  tropical: "decade-00s",
  // Flat, neon, and the social-network decade.
  twitter: "decade-10s",
  youtube: "decade-10s",
  "frutiger-metro": "decade-10s",
  "party-rock-2010": "decade-10s",
  "swag-2018": "decade-10s",
  mm2016: "decade-10s",
  "plur-rave": "decade-10s",
  "ios7-rainbow": "decade-10s",
};

/** The theme to actually render for a stored value, retired ones included. */
export function migrateTheme(value: string | null | undefined): string | null {
  if (!value) return null;
  if (THEME_IDS.has(value)) return value;
  return RETIRED_THEMES[value] ?? null;
}
