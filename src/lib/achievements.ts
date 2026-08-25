// Achievements shown on the profile.
//
// Separate from lib/badges.ts on purpose: that file is the review-count
// rank ladder the feed and leaderboard print next to a name, and it should
// stay a simple ladder. These are the things that take doing - a streak
// kept up, a category branched into, being first to review something.
//
// Every one of them is derived from activity that already exists in the
// database. Nothing here can be earned by filling in a profile field.

export type AchievementContext = {
  reviewCount: number;
  streak: number;
  longestStreak: number;
  categoriesCovered: number;
  likesReceived: number;
  commentsWritten: number;
  /** Reviews of a work nobody on the site had reviewed before. */
  discoveries: number;
  clubsJoined: number;
};

export type Achievement = {
  id: string;
  label: string;
  description: string;
  /** Whether it's been earned, and how far along if not. */
  earned: (ctx: AchievementContext) => boolean;
  progress: (ctx: AchievementContext) => { current: number; target: number };
};

function threshold(
  id: string,
  label: string,
  description: string,
  target: number,
  read: (ctx: AchievementContext) => number
): Achievement {
  return {
    id,
    label,
    description,
    earned: (ctx) => read(ctx) >= target,
    progress: (ctx) => ({ current: Math.min(read(ctx), target), target }),
  };
}

export const ACHIEVEMENTS: Achievement[] = [
  threshold("opener", "Opening Night", "Posted your first review", 1, (c) => c.reviewCount),
  threshold("streak-3", "Three Days Running", "Reviewed three days in a row", 3, (c) => c.longestStreak),
  threshold("streak-7", "Week Straight", "Reviewed seven days in a row", 7, (c) => c.longestStreak),
  threshold("streak-30", "Month Straight", "Reviewed thirty days in a row", 30, (c) => c.longestStreak),
  threshold("omnivore", "Omnivore", "Reviewed in every category", 3, (c) => c.categoriesCovered),
  threshold("scout", "Scout", "First to review something here", 1, (c) => c.discoveries),
  threshold("prospector", "Prospector", "First to review ten things here", 10, (c) => c.discoveries),
  threshold("well-liked", "Well Liked", "Collected 25 likes on your reviews", 25, (c) => c.likesReceived),
  threshold("beloved", "Beloved", "Collected 100 likes on your reviews", 100, (c) => c.likesReceived),
  threshold("in-the-thread", "In The Thread", "Left 10 comments on other people's reviews", 10, (c) => c.commentsWritten),
  threshold("joiner", "Joiner", "Joined three clubs", 3, (c) => c.clubsJoined),
];

export function earnedAchievements(ctx: AchievementContext): Achievement[] {
  return ACHIEVEMENTS.filter((a) => a.earned(ctx));
}

/**
 * The closest unearned achievement, measured by how much of it is done -
 * so the prompt on the profile is the one actually within reach, not
 * whichever happens to be first in the list.
 */
export function nextAchievement(ctx: AchievementContext): Achievement | null {
  const unearned = ACHIEVEMENTS.filter((a) => !a.earned(ctx));
  if (unearned.length === 0) return null;
  return unearned.reduce((closest, candidate) => {
    const fraction = (a: Achievement) => {
      const { current, target } = a.progress(ctx);
      return target === 0 ? 0 : current / target;
    };
    return fraction(candidate) > fraction(closest) ? candidate : closest;
  });
}

/** Longest run of consecutive days with at least one review. */
export function computeLongestStreak(postTimestamps: string[]): number {
  const days = [...new Set(postTimestamps.map((iso) => new Date(iso).toISOString().slice(0, 10)))].sort();
  if (days.length === 0) return 0;

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const previous = new Date(`${days[i - 1]}T00:00:00Z`).getTime();
    const current = new Date(`${days[i]}T00:00:00Z`).getTime();
    const isNextDay = current - previous === 24 * 60 * 60 * 1000;
    run = isNextDay ? run + 1 : 1;
    if (run > longest) longest = run;
  }
  return longest;
}
