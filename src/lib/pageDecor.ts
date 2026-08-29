import type { CSSProperties } from "react";

/**
 * The knobs that used to be reasons to write CSS.
 *
 * The custom-CSS box shipped with two examples in its placeholder:
 * `border-radius: 20px` and `rotate(-3deg)`. That is the whole problem
 * with it as a customization story - the two most obvious things anyone
 * wants to change to make a page feel theirs were only reachable by
 * typing code. Nobody should have to learn a language to give their
 * panels round corners.
 *
 * So each one is a slider now. Every value here is a number with a hard
 * range, rendered as a custom property on the profile wrapper, and the
 * stylesheet does the rest. There is no free text anywhere in this file,
 * which is why none of it needs sanitising the way the CSS box does.
 *
 * Defaults are the page exactly as it looks untouched, and only values
 * that differ from a default are emitted - so a profile nobody has
 * decorated renders identically to before this existed.
 */

export type Decor = {
  /** Panel corner rounding, in px. 0 is a sharp box, 28 is a lozenge.
   *  Default matches --panel-radius, the site's own card radius. */
  corner: number;
  /** Panel border thickness, in px. */
  outline: number;
  /** Space between stacked panels, in px. Tight or airy. */
  gap: number;
  /** Card fill opacity, as a percentage. Below 100 the page background
   *  shows through, which is the only way an uploaded photo is actually
   *  visible behind the content. Only the card takes it - the panel head
   *  is a label on the background in this design, with no fill of its
   *  own to make transparent. */
  opacity: number;
  /** Degrees each panel is rotated, alternating direction down the page.
   *  The scrapbook tilt. 0 is off. */
  tilt: number;
  /** Outer glow radius in px. 0 is off. */
  glow: number;
  /** Body text size, as a percentage of normal. */
  textSize: number;
};

export const DEFAULT_DECOR: Decor = {
  corner: 10,
  outline: 1,
  gap: 18,
  opacity: 100,
  tilt: 0,
  glow: 0,
  textSize: 100,
};

/**
 * Every control, described once.
 *
 * The editor builds itself from this list rather than repeating the
 * ranges in JSX, so a bound can't be generous in the UI and strict on
 * the server - which is how a slider ends up able to save a value the
 * renderer then clamps back, and the control appears to do nothing.
 */
export const DECOR_CONTROLS: {
  key: keyof Decor;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}[] = [
  { key: "corner", label: "Corners", hint: "Sharp to round", min: 0, max: 28, step: 1, unit: "px" },
  { key: "opacity", label: "See-through", hint: "Let your background show through the panels", min: 40, max: 100, step: 1, unit: "%" },
  { key: "tilt", label: "Tilt", hint: "Knock the panels crooked, like taped-down photos", min: 0, max: 4, step: 0.5, unit: "°" },
  { key: "glow", label: "Glow", hint: "A halo around each panel, in your accent colour", min: 0, max: 40, step: 1, unit: "px" },
  { key: "outline", label: "Outline", hint: "Border thickness", min: 0, max: 6, step: 1, unit: "px" },
  { key: "gap", label: "Spacing", hint: "Room between panels", min: 6, max: 36, step: 1, unit: "px" },
  { key: "textSize", label: "Text size", hint: "Everything on the page, scaled", min: 90, max: 130, step: 1, unit: "%" },
];

function clampNumber(raw: unknown, min: number, max: number, step: number, fallback: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  // Snapped to the control's own step, so a hand-edited row can't smuggle
  // in a value with fifteen decimal places that the slider could never
  // have produced.
  const snapped = Math.round(n / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

/** Turns whatever is stored into a Decor that is safe to render. */
export function readDecor(raw: unknown): Decor {
  const source = (raw ?? {}) as Record<string, unknown>;
  const out = { ...DEFAULT_DECOR };
  for (const control of DECOR_CONTROLS) {
    out[control.key] = clampNumber(
      source[control.key],
      control.min,
      control.max,
      control.step,
      DEFAULT_DECOR[control.key]
    );
  }
  return out;
}

export function decorIsDefault(decor: Decor): boolean {
  return DECOR_CONTROLS.every((c) => decor[c.key] === DEFAULT_DECOR[c.key]);
}

/**
 * The custom properties for one page's decor.
 *
 * Returned as a plain record rather than applied anywhere, because the
 * editor writes the same values straight onto the live page while you
 * drag a slider. One function feeding both the preview and the saved
 * render is what stops the two from disagreeing.
 */
export function decorVars(decor: Decor): Record<string, string> {
  const vars: Record<string, string> = {};

  if (decor.corner !== DEFAULT_DECOR.corner) vars["--pd-corner"] = `${decor.corner}px`;
  if (decor.outline !== DEFAULT_DECOR.outline) vars["--pd-outline"] = `${decor.outline}px`;
  if (decor.gap !== DEFAULT_DECOR.gap) vars["--pd-gap"] = `${decor.gap}px`;
  if (decor.textSize !== DEFAULT_DECOR.textSize) vars["--pd-text"] = `${decor.textSize / 100}`;

  if (decor.opacity !== DEFAULT_DECOR.opacity) {
    // Mixed toward transparent rather than set with `opacity`, which
    // would fade the text inside the panel along with the fill and make
    // a see-through page unreadable.
    vars["--pd-panel-fill"] =
      `color-mix(in srgb, var(--panel-body-bg) ${decor.opacity}%, transparent)`;
  }

  if (decor.tilt !== DEFAULT_DECOR.tilt) {
    vars["--pd-tilt"] = `${decor.tilt}deg`;
    vars["--pd-tilt-alt"] = `${-decor.tilt}deg`;
  }

  if (decor.glow !== DEFAULT_DECOR.glow) {
    vars["--pd-glow"] =
      `0 0 ${decor.glow}px color-mix(in srgb, var(--link) 65%, transparent)`;
  }

  return vars;
}

export function decorStyle(decor: Decor): CSSProperties | undefined {
  const vars = decorVars(decor);
  return Object.keys(vars).length === 0 ? undefined : (vars as CSSProperties);
}
