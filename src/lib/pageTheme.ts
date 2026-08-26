import type { CSSProperties } from "react";

// Curated presets, font pairings and background patterns for customizable
// pages. Presets exist so customization pays off immediately: picking
// "Cyber Cafe" from a list is one click, and building the same look out of
// four colour pickers is a project. The pickers are still there for anyone
// who wants them.

export type Palette = {
  bg: string | null;
  panel: string | null;
  text: string | null;
  accent: string | null;
};

export const EMPTY_PALETTE: Palette = { bg: null, panel: null, text: null, accent: null };

export type PresetTheme = {
  id: string;
  label: string;
  blurb: string;
  palette: Palette;
  fontPairId: string;
  background: { kind: BackgroundKind; value: string | null };
};

export type FontPair = {
  id: string;
  label: string;
  heading: string;
  body: string;
};

// Era-appropriate and, more importantly, actually installed on the devices
// people use. A curated list of web-safe stacks beats a font picker full of
// names that silently fall back to Arial on half the visitors' machines.
export const FONT_PAIRS: FontPair[] = [
  {
    id: "system",
    label: "Default",
    heading: "",
    body: "",
  },
  {
    id: "aqua",
    label: "Aqua",
    heading: '"Lucida Grande", "Segoe UI", system-ui, sans-serif',
    body: '"Lucida Grande", "Segoe UI", system-ui, sans-serif',
  },
  {
    id: "broadsheet",
    label: "Broadsheet",
    heading: 'Georgia, "Times New Roman", serif',
    body: 'Georgia, "Times New Roman", serif',
  },
  {
    id: "terminal",
    label: "Terminal",
    heading: '"Courier New", ui-monospace, monospace',
    body: '"Courier New", ui-monospace, monospace',
  },
  {
    id: "poster",
    label: "Poster",
    heading: 'Impact, Haettenschweiler, "Arial Black", sans-serif',
    body: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
  },
  {
    id: "scrapbook",
    label: "Scrapbook",
    heading: '"Comic Sans MS", "Bradley Hand", cursive',
    body: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
  },
  {
    id: "rounded",
    label: "Rounded",
    heading: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
    body: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
  },
];

export function fontPair(id: string | null | undefined): FontPair {
  return FONT_PAIRS.find((f) => f.id === id) ?? FONT_PAIRS[0];
}

export type BackgroundKind = "none" | "color" | "pattern" | "image";

// CSS-only patterns, so a background costs nothing to load and can't break
// on a dead image host. `value` is the pattern id; the CSS lives here.
export const BACKGROUND_PATTERNS: { id: string; label: string; css: string }[] = [
  {
    id: "starfield",
    label: "Starfield",
    css: "radial-gradient(circle at 20% 30%, rgba(255,255,255,.9) 0 1px, transparent 1px), radial-gradient(circle at 70% 60%, rgba(255,255,255,.7) 0 1px, transparent 1px), radial-gradient(circle at 45% 85%, rgba(255,255,255,.8) 0 1px, transparent 1px)",
  },
  {
    id: "grid",
    label: "Grid",
    css: "linear-gradient(rgba(255,255,255,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.14) 1px, transparent 1px)",
  },
  {
    id: "checker",
    label: "Checker",
    css: "repeating-conic-gradient(rgba(0,0,0,.16) 0% 25%, transparent 0% 50%)",
  },
  {
    id: "stripes",
    label: "Stripes",
    css: "repeating-linear-gradient(45deg, rgba(0,0,0,.12) 0 10px, transparent 10px 20px)",
  },
  {
    id: "dots",
    label: "Dots",
    css: "radial-gradient(circle, rgba(0,0,0,.18) 1.5px, transparent 1.6px)",
  },
  {
    id: "bubbles",
    label: "Bubbles",
    css: "radial-gradient(circle at 25% 25%, rgba(255,255,255,.25) 0 12px, transparent 13px), radial-gradient(circle at 75% 65%, rgba(255,255,255,.18) 0 20px, transparent 21px)",
  },
];

const PATTERN_SIZES: Record<string, string> = {
  starfield: "180px 180px",
  grid: "28px 28px",
  checker: "36px 36px",
  stripes: "auto",
  dots: "18px 18px",
  bubbles: "220px 220px",
};

export function patternById(id: string | null | undefined) {
  return BACKGROUND_PATTERNS.find((p) => p.id === id) ?? null;
}

export const PRESET_THEMES: PresetTheme[] = [
  {
    id: "none",
    label: "Site default",
    blurb: "Inherit whatever theme the visitor is browsing in.",
    palette: EMPTY_PALETTE,
    fontPairId: "system",
    background: { kind: "none", value: null },
  },
  {
    id: "aqua-blue",
    label: "Aqua",
    blurb: "Glossy blue over brushed silver. The house style.",
    palette: { bg: "#dfe9f3", panel: "#ffffff", text: "#12222f", accent: "#1d7fc4" },
    fontPairId: "aqua",
    background: { kind: "pattern", value: "grid" },
  },
  {
    id: "midnight-lcd",
    label: "Midnight LCD",
    blurb: "Black glass and a cold green readout.",
    palette: { bg: "#07110d", panel: "#0f1c18", text: "#d6ffe9", accent: "#35e08d" },
    fontPairId: "terminal",
    background: { kind: "pattern", value: "starfield" },
  },
  {
    id: "bubblegum",
    label: "Bubblegum",
    blurb: "Hot pink, white panels, far too much gloss.",
    palette: { bg: "#ffd9ec", panel: "#ffffff", text: "#3d0b28", accent: "#ff2f8e" },
    fontPairId: "scrapbook",
    background: { kind: "pattern", value: "bubbles" },
  },
  {
    id: "sunset-burn",
    label: "Sunset Burn",
    blurb: "Orange to violet, the burned-CD insert.",
    palette: { bg: "#2a1030", panel: "#3a1a3f", text: "#ffe9d6", accent: "#ff8b3d" },
    fontPairId: "poster",
    background: { kind: "pattern", value: "stripes" },
  },
  {
    id: "paper-zine",
    label: "Paper Zine",
    blurb: "Photocopied cream and typewriter ink.",
    palette: { bg: "#efe8d8", panel: "#fffdf5", text: "#241f16", accent: "#a8442a" },
    fontPairId: "broadsheet",
    background: { kind: "pattern", value: "dots" },
  },
  {
    id: "vhs-static",
    label: "VHS Static",
    blurb: "Deep blue tape with a red tracking line.",
    palette: { bg: "#0a0f2a", panel: "#141b3d", text: "#dfe4ff", accent: "#ff3b5c" },
    fontPairId: "terminal",
    background: { kind: "pattern", value: "grid" },
  },
  {
    id: "lime-y2k",
    label: "Lime Y2K",
    blurb: "Acid green on charcoal, checkerboard floor.",
    palette: { bg: "#12160f", panel: "#1c2318", text: "#e9ffd9", accent: "#a6ff33" },
    fontPairId: "rounded",
    background: { kind: "pattern", value: "checker" },
  },
  {
    id: "cyber-cafe",
    label: "Cyber Cafe",
    blurb: "Purple CRT glow and cyan links.",
    palette: { bg: "#160b2b", panel: "#221142", text: "#ece0ff", accent: "#3fe0ff" },
    fontPairId: "aqua",
    background: { kind: "pattern", value: "starfield" },
  },
];

export function presetById(id: string | null | undefined): PresetTheme | null {
  return PRESET_THEMES.find((t) => t.id === id) ?? null;
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Colours end up inside a style attribute, so they're matched, not trusted. */
export function normalizeColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return HEX.test(trimmed) ? trimmed.toLowerCase() : null;
}

/**
 * Turns a palette, font pairing and background into the CSS custom
 * properties the page paints with.
 *
 * Only what was actually chosen is emitted. A token left out keeps
 * inheriting the visitor's own theme, which is what stops a
 * half-configured page landing on hardcoded defaults that clash with
 * everything around them.
 */
export function pageStyle(
  palette: Palette,
  fontPairId: string | null,
  background: { kind: BackgroundKind; value: string | null }
): CSSProperties | undefined {
  const vars: Record<string, string> = {};

  if (palette.panel) {
    vars["--panel-body-bg"] = palette.panel;
    vars["--shelf-bg"] = palette.panel;
    vars["--panel-head-bg"] =
      `linear-gradient(180deg, color-mix(in srgb, ${palette.panel} 94%, #fff), color-mix(in srgb, ${palette.panel} 88%, #000))`;
    vars["--panel-border"] = `color-mix(in srgb, ${palette.panel} 70%, #000)`;
    vars["--panel-head-border"] = `color-mix(in srgb, ${palette.panel} 65%, #000)`;
  }
  if (palette.text) {
    vars["--text"] = palette.text;
    vars["--muted"] = `color-mix(in srgb, ${palette.text} 65%, transparent)`;
  }
  if (palette.accent) {
    vars["--link"] = palette.accent;
    vars["--like-color"] = palette.accent;

    // The profile's solid title bars are derived from the accent rather
    // than picked separately: one colour choice should visibly change the
    // whole page, which is the entire appeal of picking a theme.
    // The panel headers are glossy, so a theme supplies a gradient rather
    // than a flat fill - a solid block where the rest of the page has a
    // sheen is what makes a themed page look half-applied.
    vars["--pf-bar"] =
      `linear-gradient(180deg, color-mix(in srgb, ${palette.accent} 8%, #fff) 0%, ` +
      `color-mix(in srgb, ${palette.accent} 18%, #fff) 50%, ` +
      `color-mix(in srgb, ${palette.accent} 26%, #fff) 51%, ` +
      `color-mix(in srgb, ${palette.accent} 36%, #fff) 100%)`;
    vars["--pf-bar"] =
      `linear-gradient(180deg, color-mix(in srgb, ${palette.accent} 55%, #fff) 0%, ` +
      `color-mix(in srgb, ${palette.accent} 75%, #fff) 48%, ` +
      `color-mix(in srgb, ${palette.accent} 88%, #000) 52%, ` +
      `color-mix(in srgb, ${palette.accent} 70%, #000) 100%)`;
    vars["--pf-bar-text"] = "#fff";
    vars["--pf-line"] = `color-mix(in srgb, ${palette.accent} 45%, #000)`;
    vars["--pf-bar-alt"] =
      `linear-gradient(180deg, color-mix(in srgb, ${palette.accent} 68%, #fff) 0%, ` +
      `${palette.accent} 50%, ` +
      `color-mix(in srgb, ${palette.accent} 88%, #000) 51%, ` +
      `color-mix(in srgb, ${palette.accent} 68%, #000) 100%)`;
    vars["--pf-bar-alt-text"] = "#fff";
    vars["--pf-link"] = palette.accent;
  }

  const pair = fontPair(fontPairId);
  if (pair.body) vars["--page-font"] = pair.body;
  if (pair.heading) vars["--page-heading-font"] = pair.heading;

  // Background layers: the pattern paints over the base colour, so a page
  // with a pattern but no colour still reads against the visitor's theme.
  const layers: string[] = [];
  if (background.kind === "pattern") {
    const pattern = patternById(background.value);
    if (pattern) {
      layers.push(pattern.css);
      vars["--page-bg-size"] = PATTERN_SIZES[pattern.id] ?? "auto";
    }
  } else if (background.kind === "image" && background.value) {
    // Quoted so a URL containing a paren or space can't break out of the
    // url() and into the rest of the declaration.
    layers.push(`url("${background.value.replace(/["\\]/g, "")}")`);
    vars["--page-bg-size"] = "cover";
  }
  if (palette.bg) layers.push(`linear-gradient(${palette.bg}, ${palette.bg})`);
  if (layers.length > 0) vars["--page-bg"] = layers.join(", ");

  return Object.keys(vars).length === 0 ? undefined : (vars as CSSProperties);
}

/** Whether any colour has actually been chosen, rather than left to the theme. */
export function hasSkinChoices(palette: Palette): boolean {
  return !!(palette.bg || palette.panel || palette.text || palette.accent);
}
