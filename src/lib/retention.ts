// The three numbers the roadmap asks to track, computed from the
// activity_events log plus the posts table.
//
// A note on what these can and can't tell you: events only exist from the
// day the logging shipped, so every figure here is about members active
// since then. Anything that looks like history before that date is absence
// of data, not absence of behaviour.

export type EventRow = { user_id: string; kind: string; meta: { detail?: string } | null; created_at: string };
export type MemberRow = { id: string; username: string; created_at: string };
export type PostStamp = { user_id: string; created_at: string };

// "Same session" has no session id behind it, so it's defined as a gap
// short enough that the member plainly never left.
export const SESSION_GAP_MS = 30 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type EditFrequency = {
  /** Members who have edited their profile exactly once. */
  oneTime: number;
  /** Members who came back and edited it again on a later day. */
  repeat: number;
  /** Total edits, so the average per editor is readable. */
  totalEdits: number;
  editors: number;
  /** The controls people actually use, most-used first. */
  byControl: { detail: string; count: number }[];
};

export function computeEditFrequency(events: EventRow[]): EditFrequency {
  const edits = events.filter((e) => e.kind === "profile_edit");

  const byUser = new Map<string, EventRow[]>();
  for (const event of edits) {
    const list = byUser.get(event.user_id) ?? [];
    list.push(event);
    byUser.set(event.user_id, list);
  }

  let oneTime = 0;
  let repeat = 0;
  for (const [, list] of byUser) {
    // Counted by distinct days rather than raw edits: saving a bio and then
    // a banner in the same sitting is one person setting up, not someone
    // returning to fiddle.
    const days = new Set(list.map((e) => e.created_at.slice(0, 10)));
    if (days.size > 1) repeat++;
    else oneTime++;
  }

  const controls = new Map<string, number>();
  for (const event of edits) {
    const detail = event.meta?.detail ?? "unknown";
    controls.set(detail, (controls.get(detail) ?? 0) + 1);
  }

  return {
    oneTime,
    repeat,
    totalEdits: edits.length,
    editors: byUser.size,
    byControl: [...controls.entries()]
      .map(([detail, count]) => ({ detail, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export type EditToReview = {
  editors: number;
  sameSession: number;
  sameWeek: number;
};

/**
 * Does editing a profile lead to posting a review? Measured forward from
 * each member's first edit, so a member who was already a prolific
 * reviewer before they ever touched their profile doesn't count as
 * converted.
 */
export function computeEditToReview(events: EventRow[], posts: PostStamp[]): EditToReview {
  const firstEditByUser = new Map<string, number>();
  for (const event of events) {
    if (event.kind !== "profile_edit") continue;
    const at = new Date(event.created_at).getTime();
    const existing = firstEditByUser.get(event.user_id);
    if (existing === undefined || at < existing) firstEditByUser.set(event.user_id, at);
  }

  const postsByUser = new Map<string, number[]>();
  for (const post of posts) {
    const list = postsByUser.get(post.user_id) ?? [];
    list.push(new Date(post.created_at).getTime());
    postsByUser.set(post.user_id, list);
  }

  let sameSession = 0;
  let sameWeek = 0;
  for (const [userId, editAt] of firstEditByUser) {
    const stamps = postsByUser.get(userId) ?? [];
    const after = stamps.filter((t) => t >= editAt);
    if (after.some((t) => t - editAt <= SESSION_GAP_MS)) sameSession++;
    if (after.some((t) => t - editAt <= WEEK_MS)) sameWeek++;
  }

  return { editors: firstEditByUser.size, sameSession, sameWeek };
}

export type RetentionSegment = {
  label: string;
  cohortSize: number;
  day7: number;
  day30: number;
};

/**
 * Day-7 and day-30 return rate, split by what the member did in their
 * first week. "Returned" means any logged activity or review on or after
 * that day - the log is the only evidence of a visit we have, since page
 * views aren't recorded for signed-out or passive reading.
 *
 * Members who haven't existed long enough to have had a day 7 or day 30
 * are excluded from that column rather than counted as not returning,
 * which would drag every recent cohort toward zero.
 */
export function computeRetention(
  members: MemberRow[],
  events: EventRow[],
  posts: PostStamp[],
  now: Date = new Date()
): RetentionSegment[] {
  const activityByUser = new Map<string, number[]>();
  const add = (userId: string, iso: string) => {
    const list = activityByUser.get(userId) ?? [];
    list.push(new Date(iso).getTime());
    activityByUser.set(userId, list);
  };
  for (const event of events) add(event.user_id, event.created_at);
  for (const post of posts) add(post.user_id, post.created_at);

  const editedEarly = new Set<string>();
  const postedEarly = new Set<string>();
  const joinedAt = new Map(members.map((m) => [m.id, new Date(m.created_at).getTime()]));

  for (const event of events) {
    if (event.kind !== "profile_edit") continue;
    const joined = joinedAt.get(event.user_id);
    if (joined === undefined) continue;
    if (new Date(event.created_at).getTime() - joined <= WEEK_MS) editedEarly.add(event.user_id);
  }
  for (const post of posts) {
    const joined = joinedAt.get(post.user_id);
    if (joined === undefined) continue;
    if (new Date(post.created_at).getTime() - joined <= WEEK_MS) postedEarly.add(post.user_id);
  }

  const segments: { label: string; test: (id: string) => boolean }[] = [
    { label: "Edited profile", test: (id) => editedEarly.has(id) },
    { label: "Posted a review", test: (id) => postedEarly.has(id) },
    { label: "Did neither", test: (id) => !editedEarly.has(id) && !postedEarly.has(id) },
  ];

  const nowMs = now.getTime();

  return segments.map(({ label, test }) => {
    const cohort = members.filter((m) => test(m.id));

    const countReturns = (days: number) => {
      const eligible = cohort.filter((m) => nowMs - new Date(m.created_at).getTime() >= days * DAY_MS);
      if (eligible.length === 0) return 0;
      const returned = eligible.filter((m) => {
        const joined = new Date(m.created_at).getTime();
        return (activityByUser.get(m.id) ?? []).some((t) => t - joined >= days * DAY_MS);
      });
      return Math.round((returned.length / eligible.length) * 100);
    };

    return {
      label,
      cohortSize: cohort.length,
      day7: countReturns(7),
      day30: countReturns(30),
    };
  });
}
