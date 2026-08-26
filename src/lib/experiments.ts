import { createHash } from "node:crypto";

// Layout experiments.
//
// The homepage change in the spec is explicitly a test, not a redesign -
// the point is to find out whether pairing Feed TV with Reviews above the
// fold does better than the current stack, which you can't know by
// looking at it. So both layouts ship and each visitor gets one.

export const LAYOUT_EXPERIMENT = "homepage_layout";

export type LayoutVariant = "stack" | "paired";

/**
 * Which layout someone sees.
 *
 * Hashed from their id rather than stored, so there's no column to
 * migrate and no risk of a visitor flipping between layouts on different
 * requests - the same person always lands in the same bucket, which is
 * the one property an A/B test can't do without.
 *
 * Signed-out visitors all get the current layout. They can't post,
 * follow or customise, so they'd contribute traffic to the sample
 * without contributing any of the engagement it's meant to measure.
 */
export function layoutVariantFor(userId: string | null): LayoutVariant {
  if (!userId) return "stack";
  const digest = createHash("sha1").update(`${LAYOUT_EXPERIMENT}:${userId}`).digest();
  return digest[0] % 2 === 0 ? "stack" : "paired";
}
