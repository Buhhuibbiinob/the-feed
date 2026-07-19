export const metadata = { title: "Terms of Service — the feed" };

export default function TermsPage() {
  return (
    <div className="panel legal-page">
      <div className="panel-head">Terms of Service</div>
      <div className="panel-body">
        <p>Last updated: 2026-07-18</p>

        <h3>Eligibility</h3>
        <p>
          You must be at least 13 years old to create an account. We verify this at sign-up and
          will not create accounts for anyone younger.
        </p>

        <h3>Conduct</h3>
        <p>
          No harassment, hate speech, threats, or targeted abuse of other users. We may remove
          content or suspend accounts that violate this.
        </p>

        <h3>Content ownership</h3>
        <p>
          You own the reviews, comments, and other content you post. By posting, you grant the
          feed a license to display that content to other users as part of the normal operation
          of the service. You can edit or delete your own posts and comments at any time.
        </p>

        <h3>Account termination</h3>
        <p>
          You may stop using the service at any time. We may suspend or terminate accounts that
          violate these terms.
        </p>
      </div>
    </div>
  );
}
