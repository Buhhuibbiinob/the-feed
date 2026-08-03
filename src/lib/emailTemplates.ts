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
      `<p style="margin:28px 0 0; font-size:11px; color:#909090; text-align:center;">You're getting this because you created a Feedback account. Reply to this email to unsubscribe from the weekly newsletter.</p>` +
      `</td></tr>`
  );
}
