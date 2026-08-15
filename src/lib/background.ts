// How a member's uploaded background image is laid onto the page.
//
// Shared by the settings preview, the server action that saves the choice
// and the layout that renders it, so the preview can't drift from the
// real thing - which is the whole point of a live preview.

export const BACKGROUND_FITS = ["cover", "contain", "tile"] as const;
export type BackgroundFit = (typeof BACKGROUND_FITS)[number];

export const BACKGROUND_FIT_LABELS: Record<BackgroundFit, string> = {
  cover: "Fill",
  contain: "Fit",
  tile: "Tile",
};

export const BACKGROUND_FIT_HINTS: Record<BackgroundFit, string> = {
  cover: "Crops to fill the whole screen. Best for photos.",
  contain: "Shows the whole image, with space around it if it doesn't match your screen.",
  tile: "Repeats a small image across the page, like an old desktop wallpaper.",
};

export const DEFAULT_BACKGROUND_FIT: BackgroundFit = "cover";

export function isBackgroundFit(value: unknown): value is BackgroundFit {
  return typeof value === "string" && (BACKGROUND_FITS as readonly string[]).includes(value);
}

export type BackgroundSettings = {
  url: string;
  fit: BackgroundFit;
  flipped: boolean;
};

/**
 * The CSS `background` shorthand for one member's choice.
 *
 * Tile deliberately uses `repeat` at natural size rather than a scaled
 * `background-size`, because the 90s wallpaper look depends on seeing the
 * seams. Fill and Fit are `fixed` so the image doesn't slide under the
 * page as you scroll; tile scrolls with the page, which is how the era's
 * wallpapers actually behaved.
 */
export function backgroundCss({ url, fit }: Pick<BackgroundSettings, "url" | "fit">): string {
  const safeUrl = `url("${url.replace(/"/g, '\\"')}")`;
  if (fit === "tile") return `${safeUrl} top left / auto repeat`;
  if (fit === "contain") return `${safeUrl} center / contain fixed no-repeat`;
  return `${safeUrl} center / cover fixed no-repeat`;
}
