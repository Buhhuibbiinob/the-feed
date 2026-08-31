// Vercel's serverless functions reject request bodies over ~4.5MB with a
// platform-level error before our own code ever runs, which surfaces to
// users as a scary "This page couldn't load. A server error occurred."
// Keep every upload comfortably under that so oversized files instead get
// a friendly, specific error message (checked client-side before the file
// is even sent, and re-checked server-side).
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
// GIFs carry every frame, so a perfectly ordinary animated avatar is
// several times the size of a still. Holding them to the still limit is
// what made "upload a GIF" fail for most real GIFs.
export const MAX_GIF_BYTES = 6 * 1024 * 1024;
export const MAX_BANNER_BYTES = 3 * 1024 * 1024;
// A photography post IS the photograph, so it gets more room than a
// banner. Not unlimited room: a server action's body is capped by Next
// (6MB in next.config.ts) and by the host below that, so a bigger
// ceiling here would only move the failure to after the upload. Photos
// are shrunk in the browser first (lib/shrinkImage.ts), so a phone photo
// arrives well under this rather than being refused.
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
export const MAX_BACKGROUND_BYTES = 3 * 1024 * 1024;
export const MAX_CLUB_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_EVENT_FLYER_BYTES = 3 * 1024 * 1024;

export function megabytes(bytes: number): number {
  return Math.round(bytes / (1024 * 1024));
}

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "avif", "bmp"];

// Some mobile browsers (notably iOS Safari with HEIC/HEIF photos) submit
// File objects with an empty or unrecognized `type`, so a strict
// `file.type.startsWith("image/")` check wrongly rejects real photos.
// Fall back to checking the file extension in that case.
export function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  if (file.type !== "") return false;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.includes(ext);
}

const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif",
  bmp: "image/bmp",
};

// Storage uploads need a real content type even when the browser gave us
// an empty `file.type` (common for HEIC/HEIF on iOS Safari).
export function guessContentType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_CONTENT_TYPES[ext] ?? "application/octet-stream";
}

export function isGif(file: File): boolean {
  if (file.type === "image/gif") return true;
  // iOS sometimes hands over an empty type, so fall back to the name.
  return file.type === "" && file.name.toLowerCase().endsWith(".gif");
}

/** The size limit that applies to this file, given GIFs get more room. */
export function limitFor(file: File, stillLimit: number): number {
  return isGif(file) ? Math.max(stillLimit, MAX_GIF_BYTES) : stillLimit;
}
