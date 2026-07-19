export const metadata = { title: "Privacy Policy — the feed" };

export default function PrivacyPage() {
  return (
    <div className="panel legal-page">
      <div className="panel-head">Privacy Policy</div>
      <div className="panel-body">
        <p>Last updated: 2026-07-18</p>

        <h3>What we collect</h3>
        <ul>
          <li>
            <b>Account info:</b> your email address, username, password (stored securely,
            hashed), and birthdate. Your birthdate is used only to confirm you meet our minimum
            age requirement and is never shown on your public profile.
          </li>
          <li>
            <b>Spotify data:</b> if you connect a Spotify account, we store your Spotify access
            and refresh tokens and read your top tracks and recently played items to power
            features like &quot;On Repeat.&quot;
          </li>
          <li>
            <b>Content you post:</b> reviews, comments, chat messages, likes, follows, and any
            profile picture you upload or select.
          </li>
        </ul>

        <h3>How we use it</h3>
        <p>
          We use your data to operate the feed: showing your posts and comments to other users,
          powering the leaderboard and profile stats, personalizing your &quot;Following&quot;
          feed, and authenticating your account. We do not sell your data.
        </p>

        <h3>Sharing</h3>
        <p>
          Your username, posts, comments, likes, and follower/following counts are visible to
          other users and, by default, publicly readable. Your email address and birthdate are
          never shown to other users.
        </p>

        <h3>Your choices</h3>
        <p>
          You can edit or delete your own posts and comments at any time, disconnect your Spotify
          account, and unfollow anyone you follow.
        </p>
      </div>
    </div>
  );
}
