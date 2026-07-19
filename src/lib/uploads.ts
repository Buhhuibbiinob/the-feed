// Vercel's serverless functions reject request bodies over ~4.5MB with a
// platform-level error before our own code ever runs, which surfaces to
// users as a scary "This page couldn't load. A server error occurred."
// Keep every upload comfortably under that so oversized files instead get
// a friendly, specific error message (checked client-side before the file
// is even sent, and re-checked server-side).
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
export const MAX_BANNER_BYTES = 3 * 1024 * 1024;
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
