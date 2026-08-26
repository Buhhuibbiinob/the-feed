import Link from "next/link";
import type { DiscoverProfile } from "@/lib/discovery";

function since(iso: string | null): string | null {
  if (!iso) return null;
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (hours < 1) return "online now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d ago` : null;
}

/**
 * A profile as a card: the banner strip they chose, their picture over
 * it, and their mood. Showing the banner is the point - a directory of
 * usernames gives nobody a reason to click, and the whole bet is that a
 * decorated page is worth looking at.
 */
export function ProfileCard({
  profile,
  match,
}: {
  profile: DiscoverProfile;
  /** Taste match against the viewer, when there's enough overlap to say. */
  match?: number | null;
}) {
  const active = since(profile.lastActive);

  return (
    <Link href={`/profile/${profile.username}`} className="profile-card">
      <span
        className="profile-card-banner"
        style={
          profile.bannerUrl
            ? { backgroundImage: `url(${profile.bannerUrl})` }
            : undefined
        }
      />
      <img
        src={profile.avatarUrl || "/avatars/preset-1.svg"}
        alt=""
        className="profile-card-avatar"
      />
      <span className="profile-card-body">
        <b>
          {profile.username}
          {profile.moodEmoji && <span className="profile-card-mood">{profile.moodEmoji}</span>}
        </b>
        {profile.bio && <span className="profile-card-bio">{profile.bio}</span>}
        <span className="profile-card-meta">
          {profile.reviewCount} review{profile.reviewCount === 1 ? "" : "s"}
          {active && <> · {active}</>}
          {match != null && <span className="taste-match"> · {match}% match</span>}
        </span>
      </span>
    </Link>
  );
}
