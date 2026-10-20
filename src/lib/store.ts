// The record store's shared vocabulary: what an item is, what the shelves
// are, and what each refusal from the database means in words.
//
// No server imports here, so the 3D client can use it too. The rules
// themselves live in the database (supabase/migrations/022-store.sql);
// this file only describes them.

export type StoreFormat = "cd" | "vinyl" | "cassette" | "dvd";
export type StoreMediaType = "music" | "movie_tv";

export type StoreItem = {
  id: string;
  mediaType: StoreMediaType;
  format: StoreFormat;
  title: string;
  artist: string | null;
  year: number | null;
  genre: string | null;
  blurb: string | null;
  /** Same-origin, through /api/store/art, so WebGL can read it. */
  art: string;
  /** The catalogue's own URL, for the detail view and the board. */
  artworkUrl: string;
  previewUrl: string | null;
  previewLabel: string | null;
  storeUrl: string | null;
};

export type StoreSection = {
  id: StoreFormat;
  name: string;
  tag: string;
  /** Shelf label prefix, as on the reference photo's blue tags. */
  label: string;
  cap: number;
};

/** In walking order. Caps match store_section_cap() in migration 022. */
export const SECTIONS: StoreSection[] = [
  { id: "cd", name: "Import CDs", tag: "Aisle 1", label: "DISC", cap: 12 },
  { id: "vinyl", name: "Vinyl Wall", tag: "Aisle 2", label: "LP", cap: 8 },
  { id: "cassette", name: "Tapes", tag: "Aisle 3", label: "TAPE", cap: 10 },
  { id: "dvd", name: "DVD Wall", tag: "Aisle 4", label: "DVD", cap: 10 },
];

export const FORMAT_NAMES: Record<StoreFormat, string> = {
  cd: "CD",
  vinyl: "Vinyl LP",
  cassette: "Cassette",
  dvd: "DVD",
};

export const DAILY_LIMIT = 5;

export type StoreStatus = {
  day: string;
  limit: number;
  usedToday: number;
  inCrate: number;
  remaining: number;
  open: boolean;
  launchAt: string | null;
};

export type BoardReview = {
  postId: string;
  itemId: string;
  username: string;
  title: string;
  artist: string | null;
  mediaType: StoreMediaType;
  format: StoreFormat;
  art: string;
  rating: number | null;
  body: string;
  createdAt: string;
};

export type StoreSnapshot = {
  status: StoreStatus;
  /** Today's shelves, without anything the viewer already owns. Crate items are still listed. */
  shelves: Record<StoreFormat, StoreItem[]>;
  crate: StoreItem[];
  owned: StoreItem[];
  /** Ids of owned items the viewer has already reviewed from the bedroom. */
  reviewed: string[];
  signedIn: boolean;
  username: string | null;
  isAdmin: boolean;
};

/**
 * What a refusal from the database means, for a person.
 *
 * The functions in migration 022 raise a bare code; this is the only
 * place it becomes a sentence.
 */
export const STORE_ERRORS: Record<string, string> = {
  STORE_SIGNED_OUT: "Sign in to shop.",
  STORE_BANNED: "This account can't shop.",
  STORE_CLOSED: "The shop isn't open yet.",
  STORE_NOT_IN_STOCK: "That's not on the shelves today.",
  STORE_OWNED: "You already own that one.",
  STORE_IN_CRATE: "That's already in your crate.",
  STORE_LIMIT: "That's your five for today. The shelves restock at midnight UTC.",
  STORE_EMPTY: "Your crate is empty.",
  STORE_NOT_OWNED: "You can only review things you've taken home.",
  STORE_BAD_REVIEW: "Give it a rating or write something (up to 5,000 characters).",
};

export function storeErrorMessage(raw: string | undefined | null): string {
  const code = Object.keys(STORE_ERRORS).find((k) => raw?.includes(k));
  return code ? STORE_ERRORS[code] : "Something went wrong at the till. Try again.";
}

/** Hosts the art route will fetch from. Apple's image CDN, and nothing else. */
export function isAllowedArtHost(hostname: string): boolean {
  return hostname === "mzstatic.com" || hostname.endsWith(".mzstatic.com");
}

/** A same-origin URL for catalogue artwork, at a size for a texture. */
export function storeArtUrl(artworkUrl: string, size = 300): string {
  return `/api/store/art?u=${encodeURIComponent(artworkUrl)}&s=${size}`;
}

/** The next midnight UTC, when the shelves restock and the allowance resets. */
export function nextUtcMidnight(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}
