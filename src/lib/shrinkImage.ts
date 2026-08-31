// Shrinking a photo in the browser before it is uploaded.
//
// A phone camera JPEG is routinely 4-12MB, and there are two ceilings
// between it and the database: Next caps a server action's body (6MB
// here), and the host caps a request body below that again. A photo over
// either one fails AFTER the person has waited for it to upload, on a
// phone connection, with an error about body size that means nothing to
// them. That is the worst possible moment to enforce a limit.
//
// So the file is resized before it is sent. 2000px on the long edge is
// more than any screen on this site displays, and re-encoding at 0.85
// takes a 9MB photo to well under a megabyte with no visible difference
// at the size it is shown.
//
// Failure is not fatal: if anything here goes wrong - an image the
// browser can't decode, a canvas that won't produce a blob - the original
// file is returned and the server's own size check catches it.

export const MAX_EDGE = 2000;
export const QUALITY = 0.85;

/** True when the file is worth re-encoding at all. */
function worthShrinking(file: File): boolean {
  // A small file is already fine, and re-encoding it would only lose
  // quality for no gain.
  if (file.size < 900 * 1024) return false;
  // PNG screenshots and GIFs are left alone: re-encoding a GIF to JPEG
  // would drop the animation entirely, which is a bigger loss than the
  // bytes are worth.
  return file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp";
}

export async function shrinkImage(file: File): Promise<File> {
  if (typeof window === "undefined" || !worthShrinking(file)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

    // Already small enough on both edges and only heavy because of its
    // encoding - still worth re-encoding, so this doesn't bail out.
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY)
    );
    if (!blob || blob.size >= file.size) return file;

    // Renamed to .jpg because it IS a jpeg now, and the extension is what
    // decides the stored file's content type.
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}
