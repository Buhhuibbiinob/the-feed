// Stickers on the profile photo.
//
// Placement is a percentage of the photo's box, not pixels: the photo is
// one size in the side column, another on a phone, and another again in
// the editor's preview. Percentages put the sticker in the same place in
// all three.

export const MAX_STICKERS = 20;
export const MAX_STICKER_BYTES = 1.5 * 1024 * 1024;

export type Sticker = {
  id: string;
  imageUrl: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
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
  rotation: unknown;
}): { x: number; y: number; scale: number; rotation: number } {
  return {
    // A little past the edge is allowed on purpose - half a sticker
    // hanging off the corner of a photo is the look.
    x: clampPlacement(Number(raw.x), -20, 120, 50),
    y: clampPlacement(Number(raw.y), -20, 120, 50),
    scale: clampPlacement(Number(raw.scale), 0.25, 3, 1),
    rotation: clampPlacement(Number(raw.rotation), -180, 180, 0),
  };
}

/** The inline style that places one sticker over the photo. */
export function stickerStyle(sticker: Sticker): React.CSSProperties {
  return {
    left: `${sticker.x}%`,
    top: `${sticker.y}%`,
    transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg) scale(${sticker.scale})`,
    zIndex: sticker.z,
  };
}
