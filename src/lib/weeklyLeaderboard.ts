import { buildTasteProfile, tasteMatch, type TasteProfile } from "@/lib/taste";

// The weekly leaderboard.
//
// Weekly is the whole point: an all-time review count is a list of who
// joined earliest, and it stops being a reason to come back the moment
// someone builds an unassailable lead. Every board here is measured over a
// rolling seven days and recomputed on read, so it resets itself.

export const LEADERBOARD_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type LeaderboardPost = {
  userId: string;
  title: string;
  artist: string | null;
  rating: number | null;
  createdAt: string;
};

export type LeaderboardMember = {
  id: string;
  username: string;
  avatarUrl: string | null;
};

export type LeaderboardEntry = {
  member: LeaderboardMember;
  value: number;
  /** Rendered under the name - what the number actually means. */
  detail: string;
};

export type WeeklyBoards = {
  topReviewer: LeaderboardEntry[];
  bestTaste: LeaderboardEntry[];
  fastestRising: LeaderboardEntry[];
};

function inWindow(iso: string, from: number, to: number): boolean {
  const t = new Date(iso).getTime();
  return t >= from && t < to;
}

/**
 * "Best Taste" is the trickiest of the three to define without it just
 * being a second popularity contest. It scores how well a member's ratings
 * agree with everyone else's on the same works - being in tune with the
 * room, not being liked by it. Members with nothing in common with anyone
 * are left out rather than scored zero.
 */
function bestTasteBoard(
  members: LeaderboardMember[],
  postsByUser: Map<string, LeaderboardPost[]>,
  weekPostsByUser: Map<string, LeaderboardPost[]>
): LeaderboardEntry[] {
  const profiles = new Map<string, TasteProfile>();
  for (const member of members) {
    profiles.set(
      member.id,
      buildTasteProfile({ posts: postsByUser.get(member.id) ?? [], clubIds: [] })
    );
  }

  const entries: LeaderboardEntry[] = [];
  for (const member of members) {
    // Only rank people who actually turned up this week - otherwise the
    // board is the same faces every week regardless of activity.
    if ((weekPostsByUser.get(member.id) ?? []).length === 0) continue;

    const mine = profiles.get(member.id)!;
    const scores: number[] = [];
    for (const other of members) {
      if (other.id === member.id) continue;
      const score = tasteMatch(mine, profiles.get(other.id)!);
      if (score !== null) scores.push(score);
    }
    if (scores.length === 0) continue;

    const average = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    entries.push({
      member,
      value: Math.round(average),
      detail: `${Math.round(average)}% average match with everyone else`,
    });
  }

  return entries.sort((a, b) => b.value - a.value).slice(0, 10);
}

export function computeWeeklyBoards(
  members: LeaderboardMember[],
  posts: LeaderboardPost[],
  now: Date = new Date()
): WeeklyBoards {
  const nowMs = now.getTime();
  const weekStart = nowMs - LEADERBOARD_WINDOW_MS;
  const priorStart = weekStart - LEADERBOARD_WINDOW_MS;

  const byUser = new Map<string, LeaderboardPost[]>();
  const weekByUser = new Map<string, LeaderboardPost[]>();
  const priorByUser = new Map<string, LeaderboardPost[]>();

  const push = (map: Map<string, LeaderboardPost[]>, post: LeaderboardPost) => {
    const list = map.get(post.userId) ?? [];
    list.push(post);
    map.set(post.userId, list);
  };

  for (const post of posts) {
    push(byUser, post);
    if (inWindow(post.createdAt, weekStart, nowMs)) push(weekByUser, post);
    else if (inWindow(post.createdAt, priorStart, weekStart)) push(priorByUser, post);
  }

  const memberById = new Map(members.map((m) => [m.id, m]));

  const topReviewer: LeaderboardEntry[] = [...weekByUser.entries()]
    .flatMap(([userId, list]) => {
      const member = memberById.get(userId);
      return member
        ? [{ member, value: list.length, detail: `${list.length} review${list.length === 1 ? "" : "s"} this week` }]
        : [];
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Rising is measured as growth against last week, with a floor so a
  // member going from zero to one review doesn't top a board built on
  // percentage change.
  const fastestRising: LeaderboardEntry[] = [...weekByUser.entries()]
    .flatMap(([userId, list]) => {
      const member = memberById.get(userId);
      if (!member) return [];
      const before = (priorByUser.get(userId) ?? []).length;
      const gain = list.length - before;
      if (list.length < 2 || gain <= 0) return [];
      return [
        {
          member,
          value: gain,
          detail: before === 0 ? `${list.length} reviews, up from none` : `+${gain} on last week`,
        },
      ];
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return {
    topReviewer,
    bestTaste: bestTasteBoard(members, byUser, weekByUser),
    fastestRising,
  };
}
