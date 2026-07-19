// Single source of truth for site themes. Add a new entry here (plus a
// matching `[data-theme="id"]` block in globals.css) to introduce a theme —
// nothing else needs to change to make it selectable in Settings.
export type Theme = {
  id: string;
  label: string;
  description: string;
};

export const THEMES: Theme[] = [
  {
    id: "default",
    label: "Classic Aqua",
    description: "The original brushed-metal, deep-teal look.",
  },
  {
    id: "frutiger-aero",
    label: "Frutiger Aero",
    description: "Glossy blue/green glass with bright specular highlights.",
  },
  {
    id: "y2k-futuristic",
    label: "Y2K Futuristic",
    description: "Chrome and silver with holographic accent gradients.",
  },
  {
    id: "tumblr-fashion",
    label: "Tumblr Fashion",
    description: "Soft grunge, pastel-goth pinks and lavenders.",
  },
  {
    id: "ios-light",
    label: "iOS Light",
    description: "Clean frosted-glass white, soft blue accents.",
  },
  {
    id: "ios-dark",
    label: "iOS Dark",
    description: "Frosted-glass black, the same clean look after sunset.",
  },
  {
    id: "tuscan",
    label: "Tuscan",
    description: "Warm olive and terracotta, Windows-XP-Tuscany style.",
  },
  {
    id: "frutiger-metro",
    label: "Frutiger Metro",
    description: "Glossy Frutiger Aero blended with flat Metro tiles.",
  },
  {
    id: "mcbling",
    label: "McBling",
    description: "Hot pink chrome, rhinestones, and swirl bling patterns.",
  },
];

export const THEME_IDS = new Set(THEMES.map((t) => t.id));
export const DEFAULT_THEME = "ios-light";

export function isValidTheme(value: string | null | undefined): value is string {
  return !!value && THEME_IDS.has(value);
}
