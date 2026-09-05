import {
  BACKGROUND_PATTERNS,
  EMPTY_PALETTE,
  normalizeColor,
  presetById,
  PRESET_THEMES,
  fontPair,
  patternById,
  type BackgroundKind,
  type Palette,
} from "@/lib/pageTheme";
import { MAX_PROFILE_CSS } from "@/lib/profileCss";
import { randomDecor, readDecor, type Decor } from "@/lib/pageDecor";

// The customizable-page config: one shape, used by both profiles and club
// pages. Everything that decides how a page looks and what it contains
// lives here, and both surfaces read it through the same functions.
//
// Stored as jsonb, which means it arrives untrusted. Nothing here trusts
// the stored shape: every read runs through resolvePageConfig, which drops
// anything unrecognised and fills in what's missing. A config written by an
// older release, a hand-edited row, or a half-applied migration all resolve
// to something renderable.

export type SurfaceKind = "profile" | "club";

export type ModuleDef = {
  id: string;
  label: string;
  /** Which surfaces can show it. */
  surfaces: SurfaceKind[];
  /** A one-liner shown in the editor so the list isn't just names. */
  hint?: string;
  /**
   * Which column it sits in on a wide screen.
   *
   * "side" is for the small identity pieces - the status, the liner notes,
   * and "main" is for the things you actually read. A single stack of
   * eighteen panels is a scroll; two columns is a page you can take in at
   * a glance, which is the whole point of the reference.
   *
   * Below the breakpoint everything collapses to one column in this same
   * order, so the phone view stays sensible.
   */
  column: "main" | "side";
  /**
   * Whether a page that has never been customised shows this.
   *
   * Most are off. Turning everything on by default meant a brand-new
   * profile rendered eighteen panels, most of them empty prompts, which
   * reads as a chore rather than a page. A handful are on so the profile
   * isn't blank, and the rest are picked up in the editor by people who
   * actually want them.
   */
  defaultOn?: boolean;
};

// The labels are this site's own vocabulary, not the 2005 social network
// everyone recognises. "Top 8", "Blurbs", "About Me" and "My Anthem" are
// that site's words specifically, and a page carrying all four reads as a
// copy of it however different the code underneath is.
//
// The ids are deliberately unchanged. A stored page config references
// modules by id, so renaming one would silently reset the arrangement of
// every member who has already ordered their page.
// ---- What was taken out, and why ----
//
// Five modules went at once: the mood widget, the autoplaying profile
// song, the free-text blurbs, the top-friends row and the comment wall.
// Renaming them had not worked - "Right Now", "On Repeat", "Liner
// Notes", "Regulars" and "Signatures" are still a mood, an anthem, a
// Top 8 and a guestbook, and a page carrying all five reads as one
// particular 2005 social network whatever the labels say.
//
// The count was the other half of it. Twenty modules on one page is not
// a profile, it is a settings screen you scroll: the store front now
// says who somebody is in one screen, and everything below it was
// competing with that.
//
// Nothing is dropped from the database. The tables and every row in
// them are untouched, so restoring any of these is putting its line
// back here and rendering it again.
export const PAGE_MODULES: ModuleDef[] = [
  // Side column: who you are, at a glance.
  { id: "about", label: "Bio", surfaces: ["profile", "club"], column: "side", defaultOn: true },
  { id: "favorites", label: "Favorites", surfaces: ["profile"], column: "side", defaultOn: true },
  { id: "stats", label: "By the Numbers", surfaces: ["profile", "club"], column: "side", defaultOn: true },
  { id: "achievements", label: "Trophies", surfaces: ["profile"], column: "side" },
  { id: "clubs", label: "Clubs", surfaces: ["profile"], column: "side" },
  { id: "presence", label: "Online", surfaces: ["profile"], column: "side" },
  { id: "members", label: "Members", surfaces: ["club"], column: "side", defaultOn: true },
  { id: "info", label: "The Story", surfaces: ["club"], column: "side", defaultOn: true },
  // Main column: the things you actually read.
  { id: "obsessed", label: "Obsessed With", surfaces: ["profile"], column: "main", defaultOn: true },
  { id: "twin", label: "Taste Twin", surfaces: ["profile"], column: "main" },
  { id: "week", label: "This Week", surfaces: ["profile"], column: "main" },
  { id: "pinned", label: "Pinned", surfaces: ["profile", "club"], column: "main" },
  { id: "highlights", label: "Greatest Hits", surfaces: ["profile"], column: "main" },
  { id: "collections", label: "Collections", surfaces: ["profile"], column: "main" },
  { id: "reviews", label: "Reviews", surfaces: ["profile", "club"], column: "main", defaultOn: true },
];

export function moduleColumn(id: ModuleId): "main" | "side" {
  return PAGE_MODULES.find((m) => m.id === id)?.column ?? "main";
}

/** Where a module actually sits: the member's choice, else its default. */
export function resolvedColumn(state: ModuleState | undefined, id: ModuleId): "main" | "side" {
  return state?.column ?? moduleColumn(id);
}

export type ModuleId = string;

export type ModuleState = {
  id: ModuleId;
  shown: boolean;
  /**
   * Which column the member put it in. Absent means "wherever the module
   * ships by default" - so the layout only becomes theirs once they have
   * actually moved something.
   */
  column?: "main" | "side";
  /** Limited per-module styling. Deliberately not arbitrary CSS. */
  style?: { headerColor?: string | null; borderColor?: string | null };
};

export type PageBackground = {
  kind: BackgroundKind;
  value: string | null;
  /** How an uploaded photo is laid down. Ignored by the other kinds, so
   *  the preset themes - which are all patterns - omit it. */
  fit?: PageBackgroundFit;
};

export const PAGE_BACKGROUND_FITS = ["cover", "tile", "contain"] as const;
export type PageBackgroundFit = (typeof PAGE_BACKGROUND_FITS)[number];

export const PAGE_BACKGROUND_FIT_LABELS: Record<PageBackgroundFit, string> = {
  cover: "Fill",
  tile: "Tile",
  contain: "Fit",
};

export type SavedPreset = {
  name: string;
  themeId: string;
  palette: Palette;
  fontPairId: string;
  background: PageBackground;
};

export type PageConfig = {
  themeId: string;
  palette: Palette;
  fontPairId: string;
  background: PageBackground;
  modules: ModuleState[];
  /** Named looks the owner can switch between without rebuilding one. */
  presets: SavedPreset[];
  /** Corners, spacing, tilt, glow - the things people used to open the
   *  CSS box for. All numbers with hard ranges; see lib/pageDecor. */
  decor: Decor;
  /** Raw CSS the owner wrote. Stored as typed; sanitised and scoped at
   *  render time by sanitizeProfileCss, never trusted from here. */
  css: string;
};

export function modulesForSurface(surface: SurfaceKind): ModuleDef[] {
  return PAGE_MODULES.filter((m) => m.surfaces.includes(surface));
}

export function moduleLabel(id: ModuleId): string {
  return PAGE_MODULES.find((m) => m.id === id)?.label ?? id;
}

export function moduleHint(id: ModuleId): string | undefined {
  return PAGE_MODULES.find((m) => m.id === id)?.hint;
}

const BACKGROUND_KINDS: BackgroundKind[] = ["none", "color", "pattern", "image"];

function readBackground(raw: unknown): PageBackground {
  const source = (raw ?? {}) as Record<string, unknown>;
  const kind = BACKGROUND_KINDS.includes(source.kind as BackgroundKind)
    ? (source.kind as BackgroundKind)
    : "none";
  const value = typeof source.value === "string" ? source.value : null;
  const fit = (PAGE_BACKGROUND_FITS as readonly string[]).includes(source.fit as string)
    ? (source.fit as PageBackgroundFit)
    : "cover";

  // A pattern id that no longer exists resolves to no background rather
  // than to a broken one.
  if (kind === "pattern" && !patternById(value)) return { kind: "none", value: null, fit };
  // Only our own storage host, so a config can't point the page at an
  // arbitrary third-party URL.
  if (kind === "image" && (!value || !/^https?:\/\//i.test(value))) {
    return { kind: "none", value: null, fit };
  }

  return { kind, value, fit };
}

function readPalette(raw: unknown): Palette {
  const source = (raw ?? {}) as Record<string, unknown>;
  return {
    bg: normalizeColor(source.bg),
    panel: normalizeColor(source.panel),
    text: normalizeColor(source.text),
    accent: normalizeColor(source.accent),
  };
}

function readModules(raw: unknown, surface: SurfaceKind): ModuleState[] {
  const available = modulesForSurface(surface);
  const allowed = new Set(available.map((m) => m.id));

  const out: ModuleState[] = [];
  const seen = new Set<string>();

  for (const entry of Array.isArray(raw) ? raw : []) {
    const source = (entry ?? {}) as Record<string, unknown>;
    const id = typeof source.id === "string" ? source.id : null;
    if (!id || !allowed.has(id) || seen.has(id)) continue;
    seen.add(id);

    const style = (source.style ?? {}) as Record<string, unknown>;
    const column = source.column === "main" || source.column === "side" ? source.column : undefined;

    out.push({
      id,
      shown: source.shown !== false,
      ...(column ? { column } : {}),
      style: {
        headerColor: normalizeColor(style.headerColor),
        borderColor: normalizeColor(style.borderColor),
      },
    });
  }

  // Modules missing from the stored list are appended in their default
  // state. For a page that has never been customised that means the small
  // starter set is on and the rest are off; for an existing config it
  // means a newly shipped module arrives in the state it ships with,
  // rather than silently switching itself on for everybody.
  for (const def of available) {
    if (!seen.has(def.id)) out.push({ id: def.id, shown: def.defaultOn === true });
  }

  return out;
}

/** Turns whatever is stored into a config that is safe to render. */
export function resolvePageConfig(raw: unknown, surface: SurfaceKind): PageConfig {
  const source = (raw ?? {}) as Record<string, unknown>;
  const themeId = typeof source.themeId === "string" && presetById(source.themeId) ? source.themeId : "none";

  return {
    themeId,
    palette: readPalette(source.palette),
    fontPairId: fontPair(typeof source.fontPairId === "string" ? source.fontPairId : null).id,
    background: readBackground(source.background),
    modules: readModules(source.modules, surface),
    presets: readPresets(source.presets),
    decor: readDecor(source.decor),
    css: typeof source.css === "string" ? source.css.slice(0, MAX_PROFILE_CSS) : "",
  };
}

function readPresets(raw: unknown): SavedPreset[] {
  const out: SavedPreset[] = [];
  for (const entry of Array.isArray(raw) ? raw : []) {
    const source = (entry ?? {}) as Record<string, unknown>;
    const name = typeof source.name === "string" ? source.name.trim().slice(0, 40) : "";
    if (!name) continue;
    out.push({
      name,
      themeId: typeof source.themeId === "string" ? source.themeId : "none",
      palette: readPalette(source.palette),
      fontPairId: fontPair(typeof source.fontPairId === "string" ? source.fontPairId : null).id,
      background: readBackground(source.background),
    });
    // A handful is a switcher; a hundred is a management problem.
    if (out.length >= 8) break;
  }
  return out;
}

/**
 * Applies a preset theme's look while keeping the module arrangement.
 * Picking a new theme should not silently undo the ordering someone spent
 * time on.
 */
export function applyPreset(config: PageConfig, themeId: string): PageConfig {
  const preset = presetById(themeId);
  if (!preset) return config;
  return {
    ...config,
    themeId: preset.id,
    palette: preset.id === "none" ? EMPTY_PALETTE : { ...preset.palette },
    fontPairId: preset.fontPairId,
    background: { ...preset.background },
  };
}

/**
 * A whole page look, at random: colours, font, background and shape.
 *
 * Built from the curated preset themes rather than from random hex,
 * because six random colours is mud roughly every time - and a shuffle
 * that mostly produces something unusable stops being fun on the third
 * press. Picking a preset and then rolling the shape gives a page that
 * looks like somebody meant it, while still being somewhere you would
 * not have arrived by dragging sliders.
 *
 * The arrangement is left alone. Losing the order you put your panels in
 * because you pressed a button called Surprise me is not a surprise, it
 * is a mistake you have to undo.
 */
export function randomLook(config: PageConfig): PageConfig {
  const themes = PRESET_THEMES.filter((t) => t.id !== "none" && t.id !== config.themeId);
  const theme = themes[Math.floor(Math.random() * themes.length)];
  const pattern = BACKGROUND_PATTERNS[Math.floor(Math.random() * BACKGROUND_PATTERNS.length)];

  return {
    ...config,
    themeId: theme.id,
    palette: { ...theme.palette },
    fontPairId: theme.fontPairId,
    // An uploaded photo is something you chose and went and found. A
    // shuffle rolls the pattern instead of throwing it away.
    background:
      config.background.kind === "image"
        ? config.background
        : { kind: "pattern" as BackgroundKind, value: pattern.id },
    decor: randomDecor(config.decor),
  };
}

export function visibleModules(config: PageConfig): ModuleId[] {
  return config.modules.filter((m) => m.shown).map((m) => m.id);
}

/** Per-module style overrides, as inline custom properties. */
export function moduleStyle(state: ModuleState | undefined): React.CSSProperties | undefined {
  if (!state?.style) return undefined;
  const vars: Record<string, string> = {};
  if (state.style.headerColor) vars["--panel-head-bg"] = state.style.headerColor;
  if (state.style.borderColor) vars["--panel-border"] = state.style.borderColor;
  return Object.keys(vars).length === 0 ? undefined : (vars as React.CSSProperties);
}
