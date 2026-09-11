import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Who follows whom.
 *
 * The follows table has been in the schema the whole time and nothing
 * ever read it back. You could follow somebody and there was no number
 * anywhere that went up, no list you appeared on, and no way to see who
 * had followed you - so following was a button that did nothing you
 * could see, which is the same as a button that does nothing.
 *
 * Counts and lists are the other half. They are the part that makes the
 * button worth pressing.
 */

export type FollowCounts = { followers: number; following: number };

/**
 * How many people follow this profile, and how many it follows.
 *
 * Counted by the database rather than fetched and measured here: on a
 * profile with two thousand followers, selecting the rows to call
 * .length on them would move two thousand rows across the wire to print
 * one number.
 *
 * Zero on failure rather than throwing. A profile page that will not
 * load because a count is unavailable is a much worse page than one
 * showing a zero.
 */
export async function followCounts(
  supabase: SupabaseClient,
  profileId: string
): Promise<FollowCounts> {
  try {
    const [followers, following] = await Promise.all([
      supabase
        .from("follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("followed_id", profileId),
      supabase
        .from("follows")
        .select("followed_id", { count: "exact", head: true })
        .eq("follower_id", profileId),
    ]);
    return { followers: followers.count ?? 0, following: following.count ?? 0 };
  } catch {
    return { followers: 0, following: 0 };
  }
}

export type FollowPerson = {
  id: string;
  username: string;
  avatarUrl: string | null;
  isVerified: boolean;
};

/**
 * The people on one side of a profile's follows, newest first.
 *
 * `direction` is which way round to read the table: "followers" are the
 * people pointing AT this profile, "following" are the ones it points
 * at. One query either way; the only difference is which column is
 * matched and which is joined.
 */
export async function followList(
  supabase: SupabaseClient,
  profileId: string,
  direction: "followers" | "following",
  limit = 200
): Promise<FollowPerson[]> {
  const matchOn = direction === "followers" ? "followed_id" : "follower_id";
  const readOff = direction === "followers" ? "follower_id" : "followed_id";
  try {
    const { data, error } = await supabase
      .from("follows")
      .select(`${readOff}, created_at`)
      .eq(matchOn, profileId)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<Record<string, string>[]>();
    if (error || !data || data.length === 0) return [];

    const ids = [...new Set(data.map((row) => row[readOff]).filter(Boolean))];
    if (ids.length === 0) return [];

    // The profiles in one query rather than one each. A join through
    // PostgREST would need a named foreign key relationship and this
    // table has two pointing at the same place, which is exactly the
    // case that makes the join ambiguous.
    const { data: people } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, is_verified")
      .in("id", ids)
      .returns<
        { id: string; username: string; avatar_url: string | null; is_verified: boolean }[]
      >();
    const byId = new Map((people ?? []).map((p) => [p.id, p]));

    // Put back into follow order. The profiles query returns them in
    // whatever order it likes, and "newest first" is the whole point of
    // the list - it is how you see who just followed you.
    const out: FollowPerson[] = [];
    for (const row of data) {
      const person = byId.get(row[readOff]);
      if (!person?.username) continue;
      out.push({
        id: person.id,
        username: person.username,
        avatarUrl: person.avatar_url,
        isVerified: person.is_verified ?? false,
      });
    }
    return out;
  } catch {
    return [];
  }
}
