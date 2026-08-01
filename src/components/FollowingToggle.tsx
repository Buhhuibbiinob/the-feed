import Link from "next/link";

export function FollowingToggle({ following }: { following: boolean }) {
  return (
    <div className="feed-filter">
      <Link href="/" className={following ? "" : "active"}>
        All
      </Link>
      <Link href="/?filter=following" className={following ? "active" : ""}>
        Following
      </Link>
    </div>
  );
}
