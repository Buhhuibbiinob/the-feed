/**
 * When a bot is plausibly awake.
 *
 * Presence already works on the site: profiles.last_seen_at is stamped
 * when a member does something, and anything within the hour reads as
 * "online now". Bots never stamped it, so every bot has been permanently
 * offline since they were introduced.
 *
 * The fix is not to mark them all online. A site where twenty accounts
 * are online at four in the morning and the same twenty are online at
 * noon is more obviously fake than one where nobody is, because a real
 * community has a shape to its day.
 *
 * So each bot gets a waking window derived from its own name: stable
 * across restarts, different from its neighbours, and spread around the
 * clock so a handful are up at any hour and most are not.
 */

/** Deterministic small hash, so a name always gives the same schedule. */
function hashOf(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

/** The hour (UTC) a bot is most likely to be around, and how wide its window is. */
export function wakingWindow(username: string): { peak: number; radius: number } {
  const h = hashOf(username);
  return {
    peak: h % 24,
    // Between three and six hours either side. Some people are around all
    // evening, some drop in once.
    radius: 3 + (h % 4),
  };
}

/** Shortest distance between two hours on a 24-hour clock. */
function hourGap(a: number, b: number): number {
  const raw = Math.abs(a - b) % 24;
  return Math.min(raw, 24 - raw);
}

/**
 * Whether this bot should read as online right now.
 *
 * Probabilistic near the edges of the window rather than a hard switch,
 * so a bot does not blink on at exactly the same minute every day.
 */
export function isAwake(username: string, now: Date = new Date()): boolean {
  const { peak, radius } = wakingWindow(username);
  const gap = hourGap(now.getUTCHours(), peak);
  if (gap > radius) return false;
  // Dead centre of the window is near-certain; the edges are a coin toss.
  const closeness = 1 - gap / (radius + 1);
  return Math.random() < 0.35 + closeness * 0.55;
}

/**
 * How many bots to bring online in one pass.
 *
 * Capped hard. The point is that the site looks lived in, not that it
 * looks busy - and "14 people online" on a site with thirteen members is
 * the tell, not the trick.
 */
export function onlineBudget(botCount: number): number {
  return Math.max(1, Math.min(4, Math.round(botCount * 0.25)));
}
