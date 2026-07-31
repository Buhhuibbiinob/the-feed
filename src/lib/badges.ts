// Achievement badges unlocked purely by review count - computed on the fly
// from posts.count, no extra table needed.
export type Badge = { id: string; label: string; threshold: number };

export const BADGES: Badge[] = [
  { id: "first-review", label: "First Review", threshold: 1 },
  { id: "regular", label: "Regular", threshold: 10 },
  { id: "critic", label: "Critic", threshold: 25 },
  { id: "tastemaker", label: "Tastemaker", threshold: 50 },
  { id: "legend", label: "Legend", threshold: 100 },
];

export function earnedBadges(reviewCount: number): Badge[] {
  return BADGES.filter((b) => reviewCount >= b.threshold);
}

export function highestBadge(reviewCount: number): Badge | null {
  const earned = earnedBadges(reviewCount);
  return earned.length === 0 ? null : earned[earned.length - 1];
}
