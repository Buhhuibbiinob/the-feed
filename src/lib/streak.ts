// Current daily review streak - computed from post timestamps, no extra
// column needed. A streak stays "alive" through today or yesterday (so it
// doesn't reset to 0 the moment the clock rolls over before someone's posted
// today), then counts backward while each preceding day has a post.
function toDateKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function computeStreak(postTimestamps: string[], now: Date = new Date()): number {
  const days = new Set(postTimestamps.map(toDateKey));
  if (days.size === 0) return 0;

  const cursor = new Date(now);
  cursor.setUTCHours(0, 0, 0, 0);

  const todayKey = cursor.toISOString().slice(0, 10);
  if (!days.has(todayKey)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    const yesterdayKey = cursor.toISOString().slice(0, 10);
    if (!days.has(yesterdayKey)) return 0;
  }

  let streak = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
