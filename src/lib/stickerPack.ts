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

  // Asked for by a member: sporty, and the 2015 kind of swag.
  //
  // Drawn rather than traced. Every one of these has an obvious real
  // logo attached to it in that era - a swoosh on the sneaker, a box
  // logo on the cap - and putting somebody else's trademark on a
  // sticker other people then paste all over a public page is a
  // different kind of problem from a badly drawn shoe. So the sneaker
  // is a high-top with a red stripe, the jersey is a 23, and none of it
  // belongs to anybody.
  { id: "basketball", label: "Basketball", group: "Sporty" },
  { id: "sneaker", label: "Sneaker", group: "Sporty" },
  { id: "jersey", label: "Jersey", group: "Sporty" },
  { id: "trophy", label: "Trophy", group: "Sporty" },
  { id: "whistle", label: "Whistle", group: "Sporty" },
  { id: "stopwatch", label: "Stopwatch", group: "Sporty" },
  { id: "dumbbell", label: "Dumbbell", group: "Sporty" },

  { id: "snapback", label: "Snapback", group: "Swag" },
  { id: "shades", label: "Shades", group: "Swag" },
  { id: "chain", label: "Chain", group: "Swag" },
  { id: "hundred", label: "100", group: "Swag" },
  { id: "fire", label: "Fire", group: "Swag" },
  { id: "flipphone", label: "Flip phone", group: "Swag" },
  { id: "lipgloss", label: "Lip gloss", group: "Swag" },
  { id: "nails", label: "Nails", group: "Swag" },
  { id: "discoball", label: "Disco ball", group: "Swag" },
  { id: "dollar", label: "Money", group: "Swag" },

  // The aesthetics a member asked for by name. Grouped the way they said
  // them rather than lumped into one bin: somebody decorating a page is
  // usually going for one of these, not browsing all of them.
  { id: "palm", label: "Palm tree", group: "Cali" },
  { id: "sun", label: "Sun", group: "Cali" },
  { id: "wave", label: "Wave", group: "Cali" },
  { id: "citrus", label: "Orange", group: "Cali" },
  { id: "shake", label: "Milkshake", group: "Cali" },

  { id: "cactus", label: "Cactus", group: "Tumblr" },
  { id: "pineapple", label: "Pineapple", group: "Tumblr" },
  { id: "flamingo", label: "Flamingo", group: "Tumblr" },
  { id: "rose", label: "Rose", group: "Tumblr" },
  { id: "flashcam", label: "Camera", group: "Tumblr" },

  { id: "boombox", label: "Boombox", group: "Underground" },
  { id: "speaker", label: "Speaker", group: "Underground" },
  { id: "guitar", label: "Guitar", group: "Underground" },
  { id: "skateboard", label: "Skateboard", group: "Underground" },
  { id: "skull", label: "Skull", group: "Underground" },
  { id: "safetypin", label: "Safety pin", group: "Underground" },
  { id: "boot", label: "Boot", group: "Underground" },
];

export const STICKER_GROUPS = [
  "Cute",
  "Shiny",
  "Sporty",
  "Swag",
  "Cali",
  "Tumblr",
  "Underground",
  "Bits",
  "Media",
  "Hearts",
] as const;

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
