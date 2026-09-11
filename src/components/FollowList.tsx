import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { followCounts, followList } from "@/lib/follows";
import { VerifiedBadge } from "@/components/VerifiedBadge";

/**
 * The followers page and the following page.
 *
 * One component, because the two pages are the same page read in
 * opposite directions - same query shape, same list, same markup. Two
 * copies would be two things to keep in step and one of them would
 * quietly fall behind.
 *
 * The routes that use it are four lines each, in
 * app/profile/[username]/followers and .../following.
 */
export async function FollowList({
  username,
  direction,
}: {
  username: string;
  direction: "followers" | "following";
}) {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("username", username)
    .maybeSingle<{ id: string; username: string }>();
  if (!profile) notFound();

  const [people, counts] = await Promise.all([
    followList(supabase, profile.id, direction),
    followCounts(supabase, profile.id),
  ]);

  const heading = direction === "followers" ? "Followers" : "Following";
  const empty =
    direction === "followers"
      ? `Nobody follows ${profile.username} yet.`
      : `${profile.username} isn't following anyone yet.`;

  return (
    <main className="page-narrow">
      <nav className="crumbs">
        <Link href={`/profile/${profile.username}`}>{profile.username}</Link> / <b>{heading}</b>
      </nav>

      {/* Both counts on both pages, so this is a switch rather than a
          dead end - landing on Followers and wanting Following should
          not mean going back to the profile first. */}
      <div className="follow-tabs">
        <Link
          href={`/profile/${profile.username}/followers`}
          className={direction === "followers" ? "is-on" : ""}
        >
          {counts.followers} followers
        </Link>
        <Link
          href={`/profile/${profile.username}/following`}
          className={direction === "following" ? "is-on" : ""}
        >
          {counts.following} following
        </Link>
      </div>

      {people.length === 0 ? (
        <div className="empty-state">{empty}</div>
      ) : (
        <ul className="follow-list">
          {people.map((person) => (
            <li key={person.id}>
              <Link href={`/profile/${person.username}`}>
                {person.avatarUrl ? (
                  <img src={person.avatarUrl} alt="" className="follow-avatar" />
                ) : (
                  <span className="follow-avatar is-blank" aria-hidden="true" />
                )}
                <span>{person.username}</span>
                {person.isVerified && <VerifiedBadge />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
