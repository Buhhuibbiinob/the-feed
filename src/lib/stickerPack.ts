// The stickers that come with the site.
//
// Decorating used to begin at "Choose File / no file selected", which
// means the first step of making your page yours was going and finding a
// transparent PNG somewhere else. That is homework, not decorating.
// These are here so it starts with tapping a heart.
//
// Drawn as SVG rather than shipped as PNGs so they stay sharp when
// someone scales one up to fill half the page, which the size slider
// happily allows.

export type PackSticker = { id: string; label: string; group: string };

export const STICKER_PACK: PackSticker[] = [
  { id: "heart", label: "Heart", group: "Cute" },
  { id: "bow", label: "Bow", group: "Cute" },
  { id: "flower", label: "Flower", group: "Cute" },
  { id: "butterfly", label: "Butterfly", group: "Cute" },
  { id: "cherry", label: "Cherries", group: "Cute" },
  { id: "paw", label: "Paw", group: "Cute" },

  { id: "star", label: "Star", group: "Shiny" },
  { id: "sparkle", label: "Sparkle", group: "Shiny" },
  { id: "gem", label: "Gem", group: "Shiny" },
  { id: "crown", label: "Crown", group: "Shiny" },
  { id: "moon", label: "Moon", group: "Shiny" },
  { id: "rainbow", label: "Rainbow", group: "Shiny" },

  { id: "smiley", label: "Smiley", group: "Bits" },
  { id: "note", label: "Music note", group: "Bits" },
  { id: "bolt", label: "Lightning", group: "Bits" },
  { id: "cloud", label: "Cloud", group: "Bits" },
  { id: "bubble", label: "Speech bubble", group: "Bits" },
  { id: "arrow", label: "Arrow", group: "Bits" },
  { id: "tape", label: "Tape", group: "Bits" },

  // Drawn for the emoji keyboard, and they are stickers for free: the
  // keyboard and the pack render the same files.
  { id: "headphones", label: "Headphones", group: "Media" },
  { id: "cd", label: "CD", group: "Media" },
  { id: "vhs", label: "VHS", group: "Media" },
  { id: "clapper", label: "Clapperboard", group: "Media" },
  { id: "camera", label: "Camera", group: "Media" },
  { id: "film", label: "Film strip", group: "Media" },
  { id: "mic", label: "Microphone", group: "Media" },
  { id: "tv", label: "TV", group: "Media" },

  { id: "heart-black", label: "Black heart", group: "Hearts" },
  { id: "heart-white", label: "White heart", group: "Hearts" },
  { id: "heart-purple", label: "Purple heart", group: "Hearts" },
  { id: "heart-blue", label: "Blue heart", group: "Hearts" },
  { id: "heart-green", label: "Green heart", group: "Hearts" },
  { id: "heart-orange", label: "Orange heart", group: "Hearts" },
];

export const STICKER_GROUPS = ["Cute", "Shiny", "Bits", "Media", "Hearts"] as const;

/**
 * The image path for a pack id, or null.
 *
 * Every route into the stickers table goes through this, so a request
 * naming a sticker that doesn't exist gets nothing rather than putting
 * an arbitrary string into image_url. That is the whole reason ids are
 * posted instead of URLs.
 */
export function packStickerUrl(id: unknown): string | null {
  if (typeof id !== "string") return null;
  return STICKER_PACK.some((s) => s.id === id) ? `/stickers/${id}.svg` : null;
}

export function packStickersByGroup(group: string): PackSticker[] {
  return STICKER_PACK.filter((s) => s.group === group);
}
