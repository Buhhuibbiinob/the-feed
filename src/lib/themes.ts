// Single source of truth for site themes. Add a new entry here (plus a
// matching `[data-theme="id"]` block in globals.css) to introduce a theme -
// nothing else needs to change to make it selectable in Settings.
//
// `category` groups themes in the Settings picker tabs. "color" themes only
// swap the color/gradient tokens; "era-90s-2000s" and "era-2010-2016" themes
// also carry real structural CSS (border radius, bevel depth, spacing) in
// globals.css so they feel period-authentic, not just recolored.
export type ThemeCategory = "color" | "era-90s-2000s" | "era-2010-2016";

export type Theme = {
  id: string;
  label: string;
  description: string;
  category: ThemeCategory;
};

export const THEMES: Theme[] = [
  {
    id: "default",
    label: "Classic Aqua",
    description: "The original brushed-metal, deep-teal look.",
    category: "color",
  },
  {
    id: "frutiger-aero",
    label: "Frutiger Aero",
    description: "Glossy blue/green glass with bright specular highlights.",
    category: "era-2010-2016",
  },
  {
    id: "y2k-futuristic",
    label: "Y2K Futuristic",
    description: "Chrome and silver with holographic accent gradients.",
    category: "era-90s-2000s",
  },
  {
    id: "tumblr-fashion",
    label: "Tumblr Fashion",
    description: "Soft grunge, pastel-goth pinks and lavenders.",
    category: "era-2010-2016",
  },
  {
    id: "party-rock-2010",
    label: "Party Rock",
    description: "Neon pink/green/yellow glow on black - 2010s club-flyer energy.",
    category: "era-2010-2016",
  },
  {
    id: "ios-light",
    label: "iOS Light",
    description: "Glossy iPhone-5-era skeuomorphic chrome, soft blue accents.",
    category: "era-2010-2016",
  },
  {
    id: "ios-dark",
    label: "iOS Dark",
    description: "The same glossy skeuomorphic look after sunset.",
    category: "era-2010-2016",
  },
  {
    id: "tuscan",
    label: "Tuscan",
    description: "Warm olive and terracotta, Windows-XP-Tuscany style.",
    category: "era-90s-2000s",
  },
  {
    id: "frutiger-metro",
    label: "Frutiger Metro",
    description: "Glossy Frutiger Aero blended with flat Metro tiles.",
    category: "era-2010-2016",
  },
  {
    id: "mcbling",
    label: "McBling",
    description: "Hot pink chrome, rhinestones, and swirl bling patterns.",
    category: "era-90s-2000s",
  },
  {
    id: "vaporwave",
    label: "Vaporwave",
    description: "Pink, purple, and cyan retro-digital dreamscape.",
    category: "color",
  },
  {
    id: "win95",
    label: "Windows 95",
    description: "Classic gray beveled UI over a teal desktop background.",
    category: "era-90s-2000s",
  },
  {
    id: "synthwave",
    label: "Synthwave",
    description: "Neon sunset grid over a purple horizon, 80s outrun style.",
    category: "color",
  },
  {
    id: "dark-academia",
    label: "Dark Academia",
    description: "Burgundy, oxblood leather, and mossy library shelves.",
    category: "color",
  },
  {
    id: "cottagecore",
    label: "Cottagecore",
    description: "Cream linens, sage green, and dried wildflowers.",
    category: "color",
  },
  {
    id: "solarized-dark",
    label: "Solarized Dark",
    description: "The classic low-contrast developer palette, teal on slate.",
    category: "color",
  },
  {
    id: "matcha-zen",
    label: "Matcha Zen",
    description: "Calm matcha green and rice-paper cream, minimal and quiet.",
    category: "color",
  },
  {
    id: "halloween-gothic",
    label: "Halloween Gothic",
    description: "Black and violet with a pumpkin-orange glow.",
    category: "color",
  },
  {
    id: "winxp-bliss",
    label: "Windows XP Bliss",
    description: "Green rolling hills under a wide blue sky.",
    category: "era-90s-2000s",
  },
  {
    id: "discord-dark",
    label: "Discord Dark",
    description: "Blurple accents on charcoal, the modern chat-app look.",
    category: "era-2010-2016",
  },
  {
    id: "nordic-frost",
    label: "Nordic Frost",
    description: "Pale glacier blues and cool grays, Scandinavian calm.",
    category: "color",
  },
  {
    id: "film-reel",
    label: "Film Reel",
    description: "Chrome and gold movie-projector look with sprocket-hole dots.",
    category: "color",
  },
  {
    id: "movie-marquee",
    label: "Movie Marquee",
    description: "Broadway red and gold, lit up like a theater marquee.",
    category: "color",
  },
  {
    id: "golden-hollywood",
    label: "Golden Age Hollywood",
    description: "Black and gold Art Deco glamour with chevron trim.",
    category: "color",
  },
  {
    id: "drive-in-dusk",
    label: "Drive-In Dusk",
    description: "Dusky drive-in movie sky scattered with stars.",
    category: "color",
  },
  {
    id: "popcorn-bucket",
    label: "Popcorn Bucket",
    description: "Cheerful red-and-white striped movie-theater snack look.",
    category: "color",
  },
  {
    id: "crt-tv",
    label: "CRT Television",
    description: "Phosphor-green scanlines glowing off an old tube TV.",
    category: "era-90s-2000s",
  },
  {
    id: "static-signal",
    label: "Static Signal",
    description: "Grayscale off-air TV static, dialed in and buzzing.",
    category: "era-90s-2000s",
  },
  {
    id: "vhs-rewind",
    label: "VHS Rewind",
    description: "Purple and teal retro tape aesthetic with tracking lines.",
    category: "era-90s-2000s",
  },
  {
    id: "custom",
    label: "Custom Background",
    description: "Upload your own photo as the site background.",
    category: "color",
  },
];

export const THEME_CATEGORIES: { id: ThemeCategory; label: string }[] = [
  { id: "color", label: "Colors" },
  { id: "era-90s-2000s", label: "90s-2000s" },
  { id: "era-2010-2016", label: "2010-2016" },
];

export const THEME_IDS = new Set(THEMES.map((t) => t.id));
export const DEFAULT_THEME = "ios-light";

export function isValidTheme(value: string | null | undefined): value is string {
  return !!value && THEME_IDS.has(value);
}
