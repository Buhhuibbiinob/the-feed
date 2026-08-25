// Taste match between two members.
//
// The original version compared club membership, which meant anyone who
// reviewed things without joining a club scored nothing against anybody.
// The signal that actually exists on this site is the reviews themselves,
// so a taste profile is now built from the works someone reviewed - with
// club overlap folded in as a secondary signal rather than the whole thing.

export type TasteProfile = {
  /** Average rating per work, keyed by a normalised title+artist. */
  ratings: Map<string, number>;
  /** Everything they've engaged with: works reviewed plus clubs joined. */
  engaged: Set<string>;
};

export type TasteInput = {
  posts: { title: string; artist: string | null; rating: number | null }[];
  clubIds: Iterable<string>;
};

/**
 * Two people typing "Blonde" and "blonde " mean the same album, so works
 * are keyed on a squashed form: lowercase, punctuation dropped, runs of
 * whitespace collapsed. Artist is included because a title alone collides
 * constantly (every third album is called "Home").
 */
export function workKey(title: string, artist: string | null): string {
  const squash = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .replace(/\s+/g, " ")
      .trim();
  const t = squash(title);
  const a = artist ? squash(artist) : "";
  return a ? `${t}|${a}` : t;
}

export function buildTasteProfile({ posts, clubIds }: TasteInput): TasteProfile {
  const sums = new Map<string, { total: number; count: number }>();
  const engaged = new Set<string>();

  for (const post of posts) {
    if (!post.title) continue;
    const key = workKey(post.title, post.artist);
    engaged.add(`work:${key}`);
    if (post.rating == null) continue;
    const entry = sums.get(key) ?? { total: 0, count: 0 };
    entry.total += post.rating;
    entry.count++;
    sums.set(key, entry);
  }

  for (const clubId of clubIds) engaged.add(`club:${clubId}`);

  const ratings = new Map<string, number>();
  for (const [key, { total, count }] of sums) ratings.set(key, total / count);

  return { ratings, engaged };
}

/**
 * Blends how much two people's tastes overlap with how closely they agree
 * on the things they've both rated. Returns null when there isn't enough
 * shared data to say anything honest - a confident-looking 50% built on one
 * coincidence is worse than no number at all.
 */
export function tasteMatch(mine: TasteProfile, theirs: TasteProfile): number | null {
  const union = new Set([...mine.engaged, ...theirs.engaged]);
  if (union.size === 0) return null;

  let overlapCount = 0;
  for (const key of mine.engaged) if (theirs.engaged.has(key)) overlapCount++;
  const overlapScore = (overlapCount / union.size) * 100;

  let diffSum = 0;
  let sharedRatings = 0;
  for (const [key, mineAvg] of mine.ratings) {
    const theirAvg = theirs.ratings.get(key);
    if (theirAvg === undefined) continue;
    diffSum += Math.abs(mineAvg - theirAvg);
    sharedRatings++;
  }

  // Nothing rated in common: overlap alone is a weak claim, so it only
  // counts once there's more than a single incidental shared item.
  if (sharedRatings === 0) {
    return overlapCount < 2 ? null : Math.round(overlapScore);
  }

  const avgDiff = diffSum / sharedRatings; // 0..4 on a 1-5 scale
  const agreementScore = 100 - (avgDiff / 4) * 100;
  return Math.round(agreementScore * 0.6 + overlapScore * 0.4);
}

/** How much evidence a match rests on, for deciding what's worth showing. */
export function sharedWorkCount(mine: TasteProfile, theirs: TasteProfile): number {
  let shared = 0;
  for (const key of mine.ratings.keys()) if (theirs.ratings.has(key)) shared++;
  return shared;
}
