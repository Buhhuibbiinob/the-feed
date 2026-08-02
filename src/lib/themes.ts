// Single source of truth for site themes. Add a new entry here (plus a
// matching `[data-theme="id"]` block in globals.css) to introduce a theme -
// nothing else needs to change to make it selectable in Settings.
//
// Every theme is colors-only (swaps the color/gradient tokens) except
// ios-light, the default, which also carries its own real structural CSS
// (border radius, bevel depth, spacing) in globals.css. Everything else
// shares the site's normal default shapes/spacing so switching themes never
// reshapes anything - only recolors it.
export type ThemeCategory = "color";

export type Theme = {
  id: string;
  label: string;
  description: string;
  category: ThemeCategory;
};

export const THEMES: Theme[] = [
  {
    id: "ios-light",
    label: "Default",
    description: "Glossy brushed-metal chrome, soft blue accents. Has its own light/dark mode switch in Settings.",
    category: "color",
  },
  {
    id: "myspace",
    label: "MySpace",
    description: "Cobalt blue and black over white profile panels.",
    category: "color",
  },
  {
    id: "twitter",
    label: "Twitter",
    description: "Sky blue on clean white, flat and minimal.",
    category: "color",
  },
  {
    id: "youtube",
    label: "YouTube",
    description: "Brand red on white and black chrome.",
    category: "color",
  },
  {
    id: "mcbling",
    label: "Y2K McBling",
    description: "Hot pink chrome and rhinestones, Paris Hilton bling era.",
    category: "color",
  },
  {
    id: "scene",
    label: "Scene",
    description: "Hot pink and electric blue on black-and-white high contrast.",
    category: "color",
  },
  {
    id: "emo",
    label: "Emo",
    description: "Black and deep crimson, band-tee minimal.",
    category: "color",
  },
  {
    id: "frutiger-metro",
    label: "Frutiger Metro",
    description: "Glossy Frutiger Aero blended with flat Metro tiles.",
    category: "color",
  },
  {
    id: "frutiger-aero",
    label: "Frutiger Aero",
    description: "Glossy blue/green glass with bright specular highlights.",
    category: "color",
  },
  {
    id: "party-rock-2010",
    label: "Party Rock",
    description: "Neon pink/green/yellow glow on black - 2010s club-flyer energy.",
    category: "color",
  },
  {
    id: "champagne-bling",
    label: "Champagne Bling",
    description: "Kimora Lee Simmons champagne-gold meets Hello Kitty pink and teal.",
    category: "color",
  },
  {
    id: "swag-2018",
    label: "2018 Swag",
    description: "Black-and-white streetwear with a bold red accent.",
    category: "color",
  },
  {
    id: "mm2016",
    label: "2016",
    description: "Millennial pink and rose gold over marble white.",
    category: "color",
  },
  {
    id: "tumblr",
    label: "Tumblr",
    description: "Stark navy-on-white classic blog look.",
    category: "color",
  },
  {
    id: "tropical",
    label: "Tropical",
    description: "Zara Larsson turquoise, coral, and sunny yellow.",
    category: "color",
  },
  {
    id: "custom",
    label: "Custom Background",
    description: "Upload your own photo as the site background.",
    category: "color",
  },
];

export const THEME_CATEGORIES: { id: ThemeCategory; label: string }[] = [{ id: "color", label: "Colors" }];

export const THEME_IDS = new Set(THEMES.map((t) => t.id));
export const DEFAULT_THEME = "ios-light";

export function isValidTheme(value: string | null | undefined): value is string {
  return !!value && THEME_IDS.has(value);
}
