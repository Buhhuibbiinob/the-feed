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
    label: "Leopard Bling",
    description: "Leopard print in gold and hot pink under glossy chrome. The bling-era phone theme.",
    category: "color",
  },
  {
    id: "scene",
    label: "Scene",
    description: "Zebra diagonals, hot pink and electric cyan on black.",
    category: "color",
  },
  {
    id: "emo",
    label: "A Great Chaos",
    description: "Black, blood red and sickly teal under VHS scanlines. Horror-site energy.",
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
    description: "Sky over grass, sun flare and water beads. Glossy Vista glass.",
    category: "color",
  },
  {
    id: "party-rock-2010",
    label: "Blacklight",
    description: "Neon pink and green glowing off a dark club grid, UV-lit.",
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
    label: "Streetwear",
    description: "Box-logo red on stark black and white, with hard offset shadows.",
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
    label: "Y2K Green",
    description: "Lime and cyan halftone circles, the mid-2000s music poster.",
    category: "color",
  },
  {
    id: "zebra-bling",
    label: "Zebra Bling",
    description: "Black-and-white zebra stripes under glossy bubblegum pink.",
    category: "color",
  },
  {
    id: "plur-rave",
    label: "PLUR",
    description: "Kandi pastels, bloom and lens flare washed over a festival photo.",
    category: "color",
  },
  {
    id: "ios7-rainbow",
    label: "Rainbow",
    description: "Every colour at once - swirls and halftone over white, iOS 7 era.",
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
