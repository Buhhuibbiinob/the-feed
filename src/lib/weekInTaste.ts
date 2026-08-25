import { MEDIA_LABELS, type MediaType } from "@/lib/media";

// "Your week in taste" - the section that keeps a profile looking alive
// between visits. Computed on read rather than written by a weekly job:
// there's nothing to schedule, nothing to backfill, and it can never show
// a stale week because the window is always measured from now.

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type WeekPost = {
  id: string;
  title: string;
  artist: string | null;
  mediaType: MediaType;
  rating: number | null;
  coverUrl: string | null;
  createdAt: string;
};

export type WeekInTaste = {
  reviewCount: number;
  /** Their highest-rated review this week, if they rated anything. */
  standout: WeekPost | null;
  averageRating: number | null;
  /** Categories touched this week, most-reviewed first. */
  categories: { mediaType: MediaType; label: string; count: number }[];
  daysActive: number;
};

export function computeWeekInTaste(posts: WeekPost[], now: Date = new Date()): WeekInTaste | null {
  const cutoff = now.getTime() - WEEK_MS;
  const recent = posts.filter((p) => new Date(p.createdAt).getTime() >= cutoff);
  if (recent.length === 0) return null;

  const rated = recent.filter((p) => p.rating != null);
  const standout = rated.length
    ? rated.reduce((best, post) => ((post.rating ?? 0) > (best.rating ?? 0) ? post : best))
    : null;

  const counts = new Map<MediaType, number>();
  for (const post of recent) counts.set(post.mediaType, (counts.get(post.mediaType) ?? 0) + 1);

  const days = new Set(recent.map((p) => new Date(p.createdAt).toISOString().slice(0, 10)));

  return {
    reviewCount: recent.length,
    standout,
    averageRating: rated.length
      ? rated.reduce((sum, p) => sum + (p.rating ?? 0), 0) / rated.length
      : null,
    categories: [...counts.entries()]
      .map(([mediaType, count]) => ({ mediaType, label: MEDIA_LABELS[mediaType], count }))
      .sort((a, b) => b.count - a.count),
    daysActive: days.size,
  };
}
