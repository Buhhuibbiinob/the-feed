import type { CSSProperties } from "react";

// Per-profile colours and fonts. This is scoped to one member's profile
// page and is shown to *visitors* - it is not profiles.theme, which is the
// site theme that member sees while they browse.
//
// Only four colours are offered on purpose. A full CSS-lite editor is how
// you end up with unreadable profiles; four tokens is enough for the page
// to feel like someone's room and not enough to break it.

export type ProfileSkin = {
  bg: string | null;
  panel: string | null;
  text: string | null;
  accent: string | null;
};

export const PROFILE_FONTS = [
  { id: "system", label: "Default", stack: "" },
  { id: "serif", label: "Serif", stack: 'Georgia, "Times New Roman", serif' },
  { id: "mono", label: "Typewriter", stack: '"Courier New", ui-monospace, monospace' },
  { id: "rounded", label: "Rounded", stack: '"Trebuchet MS", "Segoe UI", system-ui, sans-serif' },
  { id: "display", label: "Display", stack: 'Impact, "Haettenschweiler", "Arial Black", sans-serif' },
  { id: "handwriting", label: "Handwriting", stack: '"Comic Sans MS", "Bradley Hand", cursive' },
  // The web fonts from lib/webFonts.ts, declared as variables on <body>.
  // A system fallback on each, so a bio still reads as intended if the
  // file hasn't arrived yet.
  { id: "arcade", label: "Arcade", stack: 'var(--f-pixelify), "Trebuchet MS", sans-serif' },
  { id: "crt", label: "CRT", stack: 'var(--f-vt323), "Courier New", monospace' },
  { id: "script", label: "Script", stack: 'var(--f-lobster), Georgia, cursive' },
  { id: "notebook", label: "Notebook", stack: 'var(--f-caveat), "Comic Sans MS", cursive' },
  { id: "magazine", label: "Magazine", stack: 'var(--f-dmserif), Georgia, serif' },
  { id: "bubble", label: "Bubble", stack: 'var(--f-quicksand), "Trebuchet MS", sans-serif' },
] as const;

export type ProfileFontId = (typeof PROFILE_FONTS)[number]["id"];

export function fontStack(id: string | null | undefined): string | null {
  const font = PROFILE_FONTS.find((f) => f.id === id);
  return font && font.stack ? font.stack : null;
}

export function isProfileFontId(value: unknown): value is ProfileFontId {
  return typeof value === "string" && PROFILE_FONTS.some((f) => f.id === value);
}

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Colours arrive from a form and end up inside a style attribute, so they
 * are matched against a strict hex pattern rather than trusted. Anything
 * else becomes null and the profile falls back to the site theme.
 */
export function normalizeColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return HEX.test(trimmed) ? trimmed.toLowerCase() : null;
}

/** Presets, so customising doesn't start from a blank colour picker. */
export const SKIN_PRESETS: { id: string; label: string; skin: ProfileSkin }[] = [
  { id: "none", label: "Site theme", skin: { bg: null, panel: null, text: null, accent: null } },
  {
    id: "midnight",
    label: "Midnight",
    skin: { bg: "#0d1020", panel: "#171b30", text: "#e6e8f5", accent: "#7c9cff" },
  },
  {
    id: "bubblegum",
    label: "Bubblegum",
    skin: { bg: "#ffe6f2", panel: "#ffffff", text: "#3d1030", accent: "#ff3d92" },
  },
  {
    id: "lime",
    label: "Lime",
    skin: { bg: "#0f1a0f", panel: "#172a17", text: "#e8ffe0", accent: "#8bff5a" },
  },
  {
    id: "paper",
    label: "Paper",
    skin: { bg: "#f4efe2", panel: "#fffdf6", text: "#2b2419", accent: "#a8622a" },
  },
  {
    id: "cobalt",
    label: "Cobalt",
    skin: { bg: "#003399", panel: "#ffffff", text: "#111111", accent: "#ff6600" },
  },
];

/**
 * The profile skin works by re-declaring the site's own theme tokens on the
 * profile's wrapper, so every panel, link and piece of body text inside it
 * recolours without any component knowing skins exist.
 *
 * Only the tokens the member actually chose are emitted. A token left out
 * keeps inheriting from whatever theme the *visitor* is browsing in, which
 * is what makes a half-configured skin land somewhere sane instead of on a
 * hardcoded default that clashes with everything around it.
 */
export function skinStyle(skin: ProfileSkin): CSSProperties | undefined {
  const vars: Record<string, string> = {};

  if (skin.bg) vars["--skin-bg"] = skin.bg;

  if (skin.panel) {
    vars["--panel-body-bg"] = skin.panel;
    vars["--shelf-bg"] = skin.panel;
    // The site's panel heads are a gradient, so a flat fill here would read
    // as a different component. Derive one from the chosen colour instead.
    vars["--panel-head-bg"] =
      `linear-gradient(180deg, color-mix(in srgb, ${skin.panel} 94%, #fff), color-mix(in srgb, ${skin.panel} 88%, #000))`;
    vars["--panel-border"] = `color-mix(in srgb, ${skin.panel} 70%, #000)`;
    vars["--panel-head-border"] = `color-mix(in srgb, ${skin.panel} 65%, #000)`;
  }

  if (skin.text) {
    vars["--text"] = skin.text;
    vars["--muted"] = `color-mix(in srgb, ${skin.text} 65%, transparent)`;
  }

  if (skin.accent) {
    vars["--link"] = skin.accent;
    vars["--like-color"] = skin.accent;
  }

  return Object.keys(vars).length === 0 ? undefined : (vars as CSSProperties);
}

export function hasSkin(skin: ProfileSkin): boolean {
  return !!(skin.bg || skin.panel || skin.text || skin.accent);
}
