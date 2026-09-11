import { toggleFollow } from "@/app/actions/follows";

/**
 * Follow somebody.
 *
 * `compact` is the version that lives in a byline rather than on a
 * profile header, and it exists because the following system had gone
 * quiet: the feed could already be filtered to people you follow, and
 * the ONLY place to follow anybody was their profile page - which you
 * had to already know to visit. So the filter was a door with nothing
 * behind it. The place people actually meet each other here is a review
 * in the feed, so that is where the button belongs.
 */
export function FollowButton({
  followedId,
  username,
  following,
  compact = false,
}: {
  followedId: string;
  username: string;
  following: boolean;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <form action={toggleFollow} className="follow-inline">
        <input type="hidden" name="followed_id" value={followedId} />
        <input type="hidden" name="username" value={username} />
        <input type="hidden" name="following" value={following ? "true" : "false"} />
        <button
          type="submit"
          className={following ? "follow-chip is-following" : "follow-chip"}
          aria-label={following ? `Unfollow ${username}` : `Follow ${username}`}
        >
          {following ? "Following" : "Follow"}
        </button>
      </form>
    );
  }
  return (
    <form action={toggleFollow}>
      <input type="hidden" name="followed_id" value={followedId} />
      <input type="hidden" name="username" value={username} />
      <input type="hidden" name="following" value={following ? "true" : "false"} />
      <button type="submit" className={following ? "btn following" : "btn"}>
        {following ? "Following" : "Follow"}
      </button>
    </form>
  );
}
