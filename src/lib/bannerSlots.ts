// The three ad shapes on the site, and the exact pixel size each renders
// at. A banner is only shown in the placement matching the shape it was
// submitted for - see fillMissingArt-style rotation in app/page.tsx.
export type BannerSlotType = "sidebar" | "wide" | "feature";

export const BANNER_SLOTS: { value: BannerSlotType; label: string; width: number; height: number }[] = [
  { value: "sidebar", label: "Square (sidebar ad)", width: 300, height: 250 },
  { value: "wide", label: "Wide banner (between posts)", width: 728, height: 90 },
  { value: "feature", label: "Homepage feature (top banner)", width: 240, height: 140 },
];

export function bannerSlotInfo(value: string): (typeof BANNER_SLOTS)[number] {
  return BANNER_SLOTS.find((s) => s.value === value) ?? BANNER_SLOTS[0];
}
