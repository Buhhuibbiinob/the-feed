import type { SupabaseClient } from "@supabase/supabase-js";

// Who gets the record store, and when.
//
// Admins get it straight away, so it can be tried before anybody else
// sees it. Everybody else gets it once the launch time has passed, and a
// countdown to it until then. The launch time is set by an admin starting
// the countdown (three days from that moment) and is stored in
// site_settings as a UTC timestamp.
//
// This decides which page to render. It is not the lock: every write the
// store makes is checked again in the database by store_is_open_for()
// (migration 022), because the page is not the only way in.

export const STORE_LAUNCH_KEY = "store_launch_at";
export const COUNTDOWN_DAYS = 3;

export type StoreAccess = {
  isAdmin: boolean;
  /** Null until an admin starts the countdown. */
  launchAt: Date | null;
  /** May use the store now. */
  open: boolean;
  /** Should see the countdown: not open, and a launch time is set. */
  counting: boolean;
};

export function parseLaunchAt(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const at = new Date(raw);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** Pure, so the rule can be checked without a database. */
export function decideAccess(isAdmin: boolean, launchAt: Date | null, now: Date = new Date()): StoreAccess {
  const launched = !!launchAt && now.getTime() >= launchAt.getTime();
  return {
    isAdmin,
    launchAt,
    open: isAdmin || launched,
    counting: !isAdmin && !launched && !!launchAt,
  };
}

export async function getStoreAccess(
  supabase: SupabaseClient,
  userId: string | null
): Promise<StoreAccess> {
  const [{ data: setting }, { data: profile }] = await Promise.all([
    supabase.from("site_settings").select("value").eq("key", STORE_LAUNCH_KEY).maybeSingle(),
    userId
      ? supabase.from("profiles").select("is_admin").eq("id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return decideAccess(!!profile?.is_admin, parseLaunchAt(setting?.value as string | undefined));
}
