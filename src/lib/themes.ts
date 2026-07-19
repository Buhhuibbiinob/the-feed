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
  {
    id: "vaporwave",
    label: "Vaporwave",
    description: "Pink, purple, and cyan retro-digital dreamscape.",
  },
  {
    id: "win95",
    label: "Windows 95",
    description: "Classic gray beveled UI over a teal desktop background.",
  },
  {
    id: "synthwave",
    label: "Synthwave",
    description: "Neon sunset grid over a purple horizon, 80s outrun style.",
  },
  {
    id: "dark-academia",
    label: "Dark Academia",
    description: "Burgundy, oxblood leather, and mossy library shelves.",
  },
  {
    id: "cottagecore",
    label: "Cottagecore",
    description: "Cream linens, sage green, and dried wildflowers.",
  },
  {
    id: "solarized-dark",
    label: "Solarized Dark",
    description: "The classic low-contrast developer palette, teal on slate.",
  },
  {
    id: "matcha-zen",
    label: "Matcha Zen",
    description: "Calm matcha green and rice-paper cream, minimal and quiet.",
  },
  {
    id: "halloween-gothic",
    label: "Halloween Gothic",
    description: "Black and violet with a pumpkin-orange glow.",
  },
  {
    id: "winxp-bliss",
    label: "Windows XP Bliss",
    description: "Green rolling hills under a wide blue sky.",
  },
  {
    id: "discord-dark",
    label: "Discord Dark",
    description: "Blurple accents on charcoal, the modern chat-app look.",
  },
  {
    id: "nordic-frost",
    label: "Nordic Frost",
    description: "Pale glacier blues and cool grays, Scandinavian calm.",
  },
  {
    id: "film-reel",
    label: "Film Reel",
    description: "Chrome and gold movie-projector look with sprocket-hole dots.",
  },
  {
    id: "movie-marquee",
    label: "Movie Marquee",
    description: "Broadway red and gold, lit up like a theater marquee.",
  },
  {
    id: "golden-hollywood",
    label: "Golden Age Hollywood",
    description: "Black and gold Art Deco glamour with chevron trim.",
  },
  {
    id: "drive-in-dusk",
    label: "Drive-In Dusk",
    description: "Dusky drive-in movie sky scattered with stars.",
  },
  {
    id: "popcorn-bucket",
    label: "Popcorn Bucket",
    description: "Cheerful red-and-white striped movie-theater snack look.",
  },
  {
    id: "crt-tv",
    label: "CRT Television",
    description: "Phosphor-green scanlines glowing off an old tube TV.",
  },
  {
    id: "static-signal",
    label: "Static Signal",
    description: "Grayscale off-air TV static, dialed in and buzzing.",
  },
  {
    id: "vhs-rewind",
    label: "VHS Rewind",
    description: "Purple and teal retro tape aesthetic with tracking lines.",
  },
  {
    id: "custom",
    label: "Custom Background",
    description: "Upload your own photo as the site background.",
  },
];

export const THEME_IDS = new Set(THEMES.map((t) => t.id));
export const DEFAULT_THEME = "ios-light";

export function isValidTheme(value: string | null | undefined): value is string {
  return !!value && THEME_IDS.has(value);
}
