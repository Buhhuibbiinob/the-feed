import type { SupabaseClient } from "@supabase/supabase-js";

// Announcements: the one place on this site where the person who runs it
// can say something to everybody at once.
//
// The rules live here, away from the database and away from React, so
// that "is this one still news?" can be tested against a fixed clock
// instead of by waiting until Friday.

export type AnnouncementStyle = "alert" | "banner";

export type Announcement = {
  id: string;
  title: string;
  body: string;
  style: AnnouncementStyle;
  button_label: string | null;
  link_url: string | null;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

export const ANNOUNCEMENT_COLUMNS =
  "id, title, body, style, button_label, link_url, active, starts_at, ends_at, created_at";

/** The longest an announcement can be before it stops being one. */
export const MAX_TITLE = 60;
export const MAX_BODY = 280;
export const MAX_BUTTON_LABEL = 20;

/**
 * Live means: switched on, started, and not finished.
 *
 * A null start is "already started" and a null end is "no end", which is
 * what leaving those boxes empty should obviously mean. `ends_at` is
 * exclusive so that an announcement ending at midnight is gone at
 * midnight rather than lingering for the last millisecond of the day.
 */
export function isLive(a: Pick<Announcement, "active" | "starts_at" | "ends_at">, now: Date): boolean {
  if (!a.active) return false;
  if (a.starts_at && new Date(a.starts_at).getTime() > now.getTime()) return false;
  if (a.ends_at && new Date(a.ends_at).getTime() <= now.getTime()) return false;
  return true;
}

/** A button only exists when it has somewhere to go. */
export function buttonFor(a: Announcement): { label: string; href: string } | null {
  const href = (a.link_url ?? "").trim();
  if (!href) return null;
  const label = (a.button_label ?? "").trim() || "Take a look";
  return { label, href };
}

/**
 * The one announcement to show, out of everything on the books.
 *
 * One at a time, deliberately. Two modal alerts stacked on top of each
 * other is not twice the message, it is a website that will not let you
 * in - so the newest live one that this person hasn't already closed
 * wins and the rest wait their turn.
 *
 * Alerts outrank banners: if the admin has both running, the one that
 * was worth interrupting for is the one that interrupts.
 */
export function pickAnnouncement(
  rows: Announcement[],
  dismissedIds: Iterable<string>,
  now: Date
): Announcement | null {
  const dismissed = new Set(dismissedIds);
  const candidates = rows
    .filter((a) => isLive(a, now))
    .filter((a) => !dismissed.has(a.id))
    .sort((a, b) => {
      if (a.style !== b.style) return a.style === "alert" ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  return candidates[0] ?? null;
}

/**
 * An announcement that ships in the code rather than the database.
 *
 * Normally announcements are rows an admin writes. This one is here
 * because the admin form could not write a row at all - the insert's
 * error was being discarded, so if the announcements table did not exist
 * yet the form reported success and nothing happened. That is fixed, but
 * fixing it does not post the announcement, and this one needed posting.
 *
 * So it is defined here and shown when no database announcement is live.
 * It needs no table, no migration and no button press. Publishing any
 * real announcement replaces it; dismissing it is remembered in the
 * browser, since there is no row for a dismissal to point at.
 */
export const BUILTIN_ANNOUNCEMENT_ID = "builtin-profiles-2026-09";

export const BUILTIN_ANNOUNCEMENT: Announcement = {
  id: BUILTIN_ANNOUNCEMENT_ID,
  title: "Profiles have a new look",
  body:
    "We've been working on this one for a while, and you all saw the archive demo. " +
    "The crowded MySpace look is gone - profiles now present your reviews properly " +
    "instead of burying them under widgets.",
  style: "alert",
  button_label: "Take a look",
  link_url: "/profiles",
  active: true,
  starts_at: null,
  ends_at: null,
  // Deliberately the beginning of time, so it always sorts last. This is
  // the announcement that speaks when nothing else does; dating it
  // "today" would have let it outrank a real one an admin published this
  // morning, which is the opposite of what a fallback is for.
  created_at: "1970-01-01T00:00:00.000Z",
};

export function isBuiltin(id: string): boolean {
  return id === BUILTIN_ANNOUNCEMENT_ID;
}

/**
 * What this viewer should see right now, or null.
 *
 * Null on ANY failure, including the table not existing yet. This runs in
 * the root layout, on every page, for signed-out visitors as well - so
 * the cost of it throwing is the whole site, and the cost of it returning
 * null is one announcement nobody sees. That is not a close call. It is
 * also the exact shape of the bug that twice took every review off this
 * site: code shipped ahead of its migration.
 */
export async function fetchAnnouncementFor(
  supabase: SupabaseClient,
  userId: string | null,
  now: Date = new Date()
): Promise<Announcement | null> {
  try {
    const { data, error } = await supabase
      .from("announcements")
      .select(ANNOUNCEMENT_COLUMNS)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error || !data) return null;

    let dismissed: string[] = [];
    if (userId) {
      const { data: rows } = await supabase
        .from("announcement_dismissals")
        .select("announcement_id")
        .eq("user_id", userId);
      dismissed = (rows ?? []).map((r) => r.announcement_id as string);
    }

    const live = pickAnnouncement(data as Announcement[], dismissed, now);
    if (live) return live;
  } catch {
    // Fall through: a missing table is exactly the case the built-in
    // announcement exists to survive.
  }

  // Nothing live in the database, so the built-in one speaks. The
  // browser decides whether it has already been dismissed - there is no
  // row for a dismissal to reference, and localStorage is checked in the
  // component either way.
  return BUILTIN_ANNOUNCEMENT;
}

/**
 * Everything on the books, for the admin screen.
 *
 * Empty array rather than a throw when the table isn't there yet, for the
 * same reason as above: an admin page that 500s is worse than an admin
 * page missing one panel, and it would take the moderation tools down
 * with it.
 */
export async function fetchAllAnnouncements(supabase: SupabaseClient): Promise<Announcement[]> {
  try {
    const { data, error } = await supabase
      .from("announcements")
      .select(ANNOUNCEMENT_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error || !data) return [];
    return data as Announcement[];
  } catch {
    return [];
  }
}
