import {
  EMPTY_PALETTE,
  normalizeColor,
  presetById,
  fontPair,
  patternById,
  type BackgroundKind,
  type Palette,
} from "@/lib/pageTheme";

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
   * "side" is for the small identity pieces - mood, blurbs, the Top 8 -
   * and "main" is for the things you actually read. A single stack of
   * eighteen panels is a scroll; two columns is a page you can take in at
   * a glance, which is the whole point of the reference.
   *
   * Below the breakpoint everything collapses to one column in this same
   * order, so the phone view stays sensible.
   */
  column: "main" | "side";
};

export const PAGE_MODULES: ModuleDef[] = [
  // Side column: who you are, at a glance.
  { id: "mood", label: "Mood ring", surfaces: ["profile"], hint: "An emoji, a colour and a few words.", column: "side" },
  { id: "anthem", label: "Anthem", surfaces: ["profile", "club"], hint: "A track pinned to the page.", column: "side" },
  { id: "about", label: "About me", surfaces: ["profile", "club"], hint: "Your bio, with light formatting.", column: "side" },
  { id: "blurbs", label: "Blurbs", surfaces: ["profile"], hint: "What you'd like to review next.", column: "side" },
  { id: "connections", label: "Top connections", surfaces: ["profile"], hint: "Your Top 8.", column: "side" },
  { id: "favorites", label: "Top artists, movies & shows", surfaces: ["profile"], column: "side" },
  { id: "stats", label: "Stats", surfaces: ["profile", "club"], column: "side" },
  { id: "achievements", label: "Achievements", surfaces: ["profile"], column: "side" },
  { id: "clubs", label: "Clubs", surfaces: ["profile"], column: "side" },
  { id: "presence", label: "Views & last online", surfaces: ["profile"], column: "side" },
  { id: "members", label: "Members", surfaces: ["club"], column: "side" },
  { id: "info", label: "About this artist", surfaces: ["club"], hint: "A wiki-style info panel.", column: "side" },
  // Main column: the things you actually read.
  { id: "obsessed", label: "Currently obsessed with", surfaces: ["profile"], column: "main" },
  { id: "twin", label: "Taste twin", surfaces: ["profile"], column: "main" },
  { id: "week", label: "Week in taste", surfaces: ["profile"], column: "main" },
  { id: "pinned", label: "Featured reviews", surfaces: ["profile", "club"], hint: "Reviews you pin yourself.", column: "main" },
  { id: "highlights", label: "Standout reviews", surfaces: ["profile"], column: "main" },
  { id: "collections", label: "Collections", surfaces: ["profile"], column: "main" },
  { id: "guestbook", label: "Guestbook", surfaces: ["profile", "club"], hint: "A public wall anyone can sign.", column: "main" },
  { id: "reviews", label: "Reviews", surfaces: ["profile", "club"], column: "main" },
];

export function moduleColumn(id: ModuleId): "main" | "side" {
  return PAGE_MODULES.find((m) => m.id === id)?.column ?? "main";
}

export type ModuleId = string;

export type ModuleState = {
  id: ModuleId;
  shown: boolean;
  /** Limited per-module styling. Deliberately not arbitrary CSS. */
  style?: { headerColor?: string | null; borderColor?: string | null };
};

export type PageBackground = {
  kind: BackgroundKind;
  value: string | null;
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

  // A pattern id that no longer exists resolves to no background rather
  // than to a broken one.
  if (kind === "pattern" && !patternById(value)) return { kind: "none", value: null };
  // Only our own storage host, so a config can't point the page at an
  // arbitrary third-party URL.
  if (kind === "image" && (!value || !/^https?:\/\//i.test(value))) return { kind: "none", value: null };

  return { kind, value };
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
    out.push({
      id,
      shown: source.shown !== false,
      style: {
        headerColor: normalizeColor(style.headerColor),
        borderColor: normalizeColor(style.borderColor),
      },
    });
  }

  // Modules that didn't exist when this config was saved are appended and
  // shown, so shipping one doesn't make it invisible to everybody who has
  // ever opened the editor.
  for (const def of available) {
    if (!seen.has(def.id)) out.push({ id: def.id, shown: true });
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
