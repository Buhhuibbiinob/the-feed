import Link from "next/link";
import type { DiscoverProfile } from "@/lib/discovery";
import { EmojiText } from "@/lib/emojiText";

function since(iso: string | null): string | null {
  if (!iso) return null;
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (hours < 1) return "online now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d ago` : null;
}

/**
 * A profile as a card: the banner they chose, their picture over it, and
 * their mood. Showing the banner is the point - a directory of usernames
 * gives nobody a reason to click, and the whole bet is that a decorated
 * page is worth looking at.
 *
 * Which is why the banner used to be a 62px strip, which is the height
 * at which somebody's Hello Kitty header is a smear of pink. It is the
 * biggest thing on the card now, and the avatar sits across its lower
 * edge rather than floating inside the body, so the two read as one
 * object the way they do on the profile itself.
 *
 * The counts moved into a footer under a hairline. On a member with no
 * reviews yet, "0 reviews" sitting directly under their name was the
 * loudest thing on their card.
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
        <b className="profile-card-name">
          {profile.username}
          {profile.moodEmoji && (
            <span className="profile-card-mood">
              {/* Drawn by the site, like every other emoji on it. This was
                  the last place still rendering whatever the reader's
                  phone draws. */}
              <EmojiText size={15}>{profile.moodEmoji}</EmojiText>
            </span>
          )}
        </b>
        {profile.bio && (
          <span className="profile-card-bio">
            <EmojiText size={14}>{profile.bio}</EmojiText>
          </span>
        )}
      </span>
      <span className="profile-card-foot">
        <span>
          {profile.reviewCount} review{profile.reviewCount === 1 ? "" : "s"}
        </span>
        {active && (
          <span className={`profile-card-active${active === "online now" ? " live" : ""}`}>
            {active}
          </span>
        )}
        {match != null && <span className="taste-match">{match}% match</span>}
      </span>
    </Link>
  );
}
