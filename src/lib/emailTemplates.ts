// Branded transactional email templates, sent through Resend directly so we
// control the markup end to end. Supabase's own auth emails are bypassed
// entirely (see signUp in app/actions/auth.ts) - it only generates the
// confirmation token, we do the sending.

function shell(bodyRows: string): string {
  return (
    `<div style="margin:0; padding:30px 12px; background-color:#f1f1f1; font-family:-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;">` +
    `<table role="presentation" width="480" cellpadding="0" cellspacing="0" align="center" style="max-width:480px; width:100%; background-color:#ffffff; border:1px solid #d3d3d3; border-radius:8px; overflow:hidden; box-shadow:0 4px 14px rgba(0,0,0,0.15);">` +
    // Header: white, logo front and center
    `<tr><td style="background-color:#ffffff; border-bottom:1px solid #e5e5e5; padding:24px 20px; text-align:center;">` +
    `<img src="https://mythefeed.com/f-logo.PNG" width="56" height="56" alt="Feedback" style="border-radius:8px; display:block; margin:0 auto 8px;" />` +
    `<span style="font-size:18px; font-weight:600; color:#0f0f0f;">Feedback</span>` +
    `</td></tr>` +
    bodyRows +
    // Footer
    `<tr><td style="background-color:#fafafa; border-top:1px solid #e5e5e5; padding:14px 20px; text-align:center;">` +
    `<span style="font-size:11px; color:#909090;">Feedback &middot; Post quick reviews of music, movies, and TV</span>` +
    `</td></tr>` +
    `</table></div>`
  );
}

const RED_BUTTON =
  "display:inline-block; background-color:#ff0000; background-image:linear-gradient(180deg,#ff4c4c 0%,#ff0000 46%,#cc0000 50%,#900000 100%); color:#ffffff; font-size:16px; font-weight:600; text-decoration:none; padding:14px 36px; border-radius:4px; border:1px solid #900000; box-shadow:0 2px 6px rgba(0,0,0,0.25);";

export function renderConfirmEmail(confirmUrl: string): string {
  return shell(
    `<tr><td style="padding:32px 28px; text-align:center;">` +
      `<h1 style="margin:0 0 12px; font-size:22px; font-weight:600; color:#0f0f0f;">Confirm your email address</h1>` +
      `<p style="margin:0 0 24px; font-size:14px; line-height:1.5; color:#606060;">Almost there. Click the button below to confirm your email and you'll be signed in to Feedback automatically.</p>` +
      `<a href="${confirmUrl}" style="${RED_BUTTON}">Confirm Email Address</a>` +
      `<p style="margin:28px 0 0; font-size:11px; color:#909090;">Didn't sign up for Feedback? You can safely ignore this email.</p>` +
      `</td></tr>`
  );
}

export function renderResetEmail(resetUrl: string): string {
  return shell(
    `<tr><td style="padding:32px 28px; text-align:center;">` +
      `<h1 style="margin:0 0 12px; font-size:22px; font-weight:600; color:#0f0f0f;">Reset your password</h1>` +
      `<p style="margin:0 0 24px; font-size:14px; line-height:1.5; color:#606060;">Click below to choose a new password. This link can only be used once, and expires in an hour.</p>` +
      `<a href="${resetUrl}" style="${RED_BUTTON}">Reset Password</a>` +
      `<p style="margin:28px 0 0; font-size:11px; color:#909090;">Didn't ask to reset your password? You can safely ignore this email, your password won't change.</p>` +
      `</td></tr>`
  );
}

export function renderMagicLinkEmail(loginUrl: string): string {
  return shell(
    `<tr><td style="padding:32px 28px; text-align:center;">` +
      `<h1 style="margin:0 0 12px; font-size:22px; font-weight:600; color:#0f0f0f;">Your sign-in link</h1>` +
      `<p style="margin:0 0 24px; font-size:14px; line-height:1.5; color:#606060;">Click below to sign in to Feedback. No password needed. This link can only be used once.</p>` +
      `<a href="${loginUrl}" style="${RED_BUTTON}">Sign In</a>` +
      `<p style="margin:28px 0 0; font-size:11px; color:#909090;">Didn't try to sign in? You can safely ignore this email.</p>` +
      `</td></tr>`
  );
}

// One-off send to existing users after the confirm/reset links were fixed.
// Carries a live magic link, but magic links expire in about an hour, so it
// also spells out the self-serve route for anyone reading it later.
export function renderReturningSignInEmail(loginUrl: string, siteUrl: string): string {
  return shell(
    `<tr><td style="padding:32px 28px; text-align:center;">` +
      `<h1 style="margin:0 0 12px; font-size:22px; font-weight:600; color:#0f0f0f;">Here's a fresh sign-in link</h1>` +
      `<p style="margin:0 0 24px; font-size:14px; line-height:1.5; color:#606060;">A problem was stopping some confirmation and password reset links from working, so you may not have been able to get into your account. That's fixed now. Use the button below to sign straight in.</p>` +
      `<a href="${loginUrl}" style="${RED_BUTTON}">Sign In</a>` +
      `<p style="margin:24px 0 0; font-size:12px; line-height:1.5; color:#606060;">This link expires in about an hour and can only be used once. If it's already expired, just go to <a href="${siteUrl}/forgot-password" style="color:#2f6fce;">${siteUrl}/forgot-password</a> and request a new one, that works now too.</p>` +
      `<p style="margin:20px 0 0; font-size:11px; color:#909090;">Didn't sign up for Feedback? You can safely ignore this email.</p>` +
      `</td></tr>`
  );
}

export function renderWelcomeEmail(username: string, siteUrl: string): string {
  return shell(
    `<tr><td style="padding:32px 28px;">` +
      `<h1 style="margin:0 0 12px; font-size:22px; font-weight:600; color:#0f0f0f; text-align:center;">Welcome, ${username}</h1>` +
      `<p style="margin:0 0 20px; font-size:14px; line-height:1.5; color:#606060; text-align:center;">You're subscribed to The Feedback Weekly. Every week we round up new releases, underground artists and filmmakers worth hearing about, and the best reviews the community posted.</p>` +
      `<p style="margin:0 0 24px; font-size:14px; line-height:1.6; color:#606060;">While you wait for the first issue:</p>` +
      `<ul style="margin:0 0 26px; padding-left:20px; font-size:14px; line-height:1.7; color:#606060;">` +
      `<li>Post a review of something you've been listening to or watching</li>` +
      `<li>Start a fan club for an artist, movie, or show you love</li>` +
      `<li>If you make music or films yourself, share your own work</li>` +
      `</ul>` +
      `<div style="text-align:center;"><a href="${siteUrl}" style="${RED_BUTTON}">Open Feedback</a></div>` +
      `<p style="margin:28px 0 0; font-size:11px; color:#909090; text-align:center;">You're getting this because you created a Feedback account.</p>` +
      `</td></tr>`
  );
}

export type DigestLine = { text: string; href: string };

/**
 * The activity digest. One email covering everything since the last one,
 * rather than a mail per like - which is how a member with one popular
 * review ends up with fifteen emails and an unsubscribe.
 *
 * Every line is plain text built server-side from the member's own
 * notifications; usernames and titles are escaped by the caller.
 */
export function renderDigestEmail(
  username: string,
  lines: DigestLine[],
  siteUrl: string,
  settingsUrl: string
): string {
  const rows = lines
    .map(
      (line) =>
        `<tr><td style="padding:9px 0; border-bottom:1px solid #f0f0f0; font-size:14px; color:#333;">` +
        `<a href="${line.href}" style="color:#1d7fc4; text-decoration:none;">${line.text}</a>` +
        `</td></tr>`
    )
    .join("");

  return shell(
    `<tr><td style="padding:28px;">` +
      `<h1 style="margin:0 0 4px; font-size:20px; font-weight:600; color:#0f0f0f;">While you were away</h1>` +
      `<p style="margin:0 0 18px; font-size:13px; color:#707070;">Here's what happened on your profile and reviews, ${username}.</p>` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>` +
      `<p style="margin:22px 0 0; text-align:center;">` +
      `<a href="${siteUrl}/alerts" style="${RED_BUTTON}">See all your alerts</a>` +
      `</p>` +
      `<p style="margin:20px 0 0; font-size:11px; color:#909090; text-align:center;">` +
      `Getting too many of these? <a href="${settingsUrl}" style="color:#909090;">Change what gets emailed</a>.` +
      `</p>` +
      `</td></tr>`
  );
}
