function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Taste match %, blending how much overlap two users have in the clubs
 * they're engaged with (joined or posted in) with how closely their
 * ratings agree on clubs they've both rated. Returns null when there's
 * not enough shared data to say anything meaningful.
 */
export function computeTasteMatch(
  myRatings: Map<string, number[]>,
  myClubIds: Set<string>,
  theirRatings: Map<string, number[]>,
  theirClubIds: Set<string>
): number | null {
  const engagedMine = new Set([...myClubIds, ...myRatings.keys()]);
  const engagedTheirs = new Set([...theirClubIds, ...theirRatings.keys()]);
  const union = new Set([...engagedMine, ...engagedTheirs]);
  if (union.size === 0) return null;

  let intersectionCount = 0;
  for (const id of engagedMine) if (engagedTheirs.has(id)) intersectionCount++;
  const jaccardScore = (intersectionCount / union.size) * 100;

  let diffSum = 0;
  let diffCount = 0;
  for (const [clubId, ratings] of myRatings) {
    const theirs = theirRatings.get(clubId);
    if (!theirs) continue;
    diffSum += Math.abs(average(ratings) - average(theirs));
    diffCount++;
  }

  if (diffCount === 0) return Math.round(jaccardScore);

  const avgDiff = diffSum / diffCount; // 0..4 (ratings are 1-5)
  const ratingScore = 100 - (avgDiff / 4) * 100;
  return Math.round(ratingScore * 0.6 + jaccardScore * 0.4);
}
