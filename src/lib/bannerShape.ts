// Banner shapes. The member picks one, the crop field renders at that
// ratio, and the profile head is sized from the same table - so the banner
// they framed is the banner that shows, rather than one fixed template
// their photo has to survive.

export const BANNER_ASPECTS = [
  { id: "wide", label: "Wide", width: 1200, height: 300 },
  { id: "standard", label: "Standard", width: 1200, height: 400 },
  { id: "tall", label: "Tall", width: 1200, height: 600 },
] as const;

export type BannerAspectId = (typeof BANNER_ASPECTS)[number]["id"];
export const DEFAULT_BANNER_ASPECT: BannerAspectId = "standard";

export function isBannerAspect(value: unknown): value is BannerAspectId {
  return typeof value === "string" && BANNER_ASPECTS.some((a) => a.id === value);
}

export function bannerAspect(value: string | null | undefined) {
  return BANNER_ASPECTS.find((a) => a.id === value) ?? BANNER_ASPECTS.find((a) => a.id === DEFAULT_BANNER_ASPECT)!;
}

/** CSS aspect-ratio value for the profile head that carries the banner. */
export function bannerAspectRatio(value: string | null | undefined): string {
  const shape = bannerAspect(value);
  return `${shape.width} / ${shape.height}`;
}
