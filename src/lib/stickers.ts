// Stickers on the profile photo.
//
// Placement is a percentage of the photo's box, not pixels: the photo is
// one size in the side column, another on a phone, and another again in
// the editor's preview. Percentages put the sticker in the same place in
// all three.

export const MAX_STICKERS = 20;

// A sticker's z decides which layer it lands in: below zero renders
// behind the panels, zero and up renders over them. Two layers rather
// than one, because a layer with its own z-index becomes a stacking
// context and its children can no longer be interleaved with anything
// outside it.
export const Z_BEHIND = -1;
export const Z_FRONT = 1;

export function isBehind(sticker: { z: number }): boolean {
  return sticker.z < 0;
}
export const MAX_STICKER_BYTES = 1.5 * 1024 * 1024;

export type Sticker = {
  id: string;
  imageUrl: string;
  x: number;
  y: number;
  /** Horizontal scale. */
  scale: number;
  /** Vertical scale - separate, so a sticker can be squashed or stretched. */
  scaleY: number;
  rotation: number;
  /** Horizontal skew in degrees, for leaning one over. */
  skew: number;
  z: number;
};

// Clamped rather than rejected: a sticker dragged past the edge should
// stop at the edge, not fail to save.
export function clampPlacement(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function normalizeSticker(raw: {
  x: unknown;
  y: unknown;
  scale: unknown;
  scaleY: unknown;
  rotation: unknown;
  skew: unknown;
}): { x: number; y: number; scale: number; scale_y: number; rotation: number; skew: number } {
  return {
    // Well past the edge is allowed on purpose - half a sticker hanging
    // off the side of the page is the look.
    x: clampPlacement(Number(raw.x), -20, 120, 50),
    y: clampPlacement(Number(raw.y), -20, 120, 50),
    // Wide open: a sticker the size of the whole page is a legitimate
    // thing to want, and so is a tiny one tucked in a corner.
    scale: clampPlacement(Number(raw.scale), 0.05, 12, 1),
    scale_y: clampPlacement(Number(raw.scaleY), 0.05, 12, 1),
    rotation: clampPlacement(Number(raw.rotation), -180, 180, 0),
    skew: clampPlacement(Number(raw.skew), -60, 60, 0),
  };
}

/** The transform that places one sticker. */
export function stickerTransform(s: {
  rotation: number;
  scale: number;
  scaleY: number;
  skew: number;
}): string {
  return (
    `translate(-50%, -50%) rotate(${s.rotation}deg) ` +
    `skewX(${s.skew}deg) scale(${s.scale}, ${s.scaleY})`
  );
}
