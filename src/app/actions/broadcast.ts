"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { siteUrl } from "@/lib/site";
import { sendEmail } from "@/lib/email";
import { renderReturningSignInEmail } from "@/lib/emailTemplates";

export type BroadcastState = {
  error?: string;
  ok?: boolean;
  sent?: number;
  failed?: number;
  skipped?: number;
};

// Resend's free tier caps out around 2 requests/sec, and each user needs a
// separately generated link anyway, so this sends one at a time with a
// small gap rather than batching.
const SEND_GAP_MS = 600;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One-off: email every account a fresh magic sign-in link, for use after the
 * confirm/reset links were landing on the home page. Admin-only, and
 * deliberately not wired to run on any schedule - it mints a live credential
 * per user, so it should only ever go out when someone decides it should.
 */
export async function adminSendSignInLinks(
  _prevState: BroadcastState,
  formData: FormData
): Promise<BroadcastState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAdmin(supabase, user.id))) {
    return { error: "Admins only." };
  }

  // Typed confirmation, so this can't fire from a stray click.
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "SEND") {
    return { error: 'Type SEND in the box to confirm before sending.' };
  }

  const admin = createAdminClient();
  const site = siteUrl();

  // Collect every account email (paginated - the admin API caps per page).
  const users: { id: string; email: string }[] = [];
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data) {
      return { error: `Couldn't list users: ${error?.message ?? "no data returned"}` };
    }
    for (const u of data.users) {
      if (u.email) users.push({ id: u.id, email: u.email });
    }
    if (data.users.length < 1000) break;
    page++;
  }

  if (users.length === 0) return { error: "No accounts with an email address found." };

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const u of users) {
    // Addresses that can't receive mail (leftover test accounts) would just
    // bounce and hurt sending reputation.
    if (/@(example|test)\.(com|org|net)$/i.test(u.email)) {
      skipped++;
      continue;
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: u.email,
    });

    const hashedToken = linkData?.properties?.hashed_token;
    if (linkError || !hashedToken) {
      console.error(`[broadcast] generateLink failed for ${u.email}: ${linkError?.message ?? "no token"}`);
      failed++;
      continue;
    }

    const loginUrl = `${site}/auth/callback?token_hash=${encodeURIComponent(hashedToken)}&type=magiclink`;
    const result = await sendEmail(
      "Your sign-in link for Feedback",
      renderReturningSignInEmail(loginUrl, site),
      u.email
    );

    if (result.ok) {
      sent++;
    } else {
      console.error(`[broadcast] send failed for ${u.email}: ${result.error}`);
      failed++;
    }

    await sleep(SEND_GAP_MS);
  }

  return { ok: true, sent, failed, skipped };
}
