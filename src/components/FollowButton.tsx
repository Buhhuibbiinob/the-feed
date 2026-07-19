import { toggleFollow } from "@/app/actions/follows";

export function FollowButton({
  followedId,
  username,
  following,
}: {
  followedId: string;
  username: string;
  following: boolean;
}) {
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
