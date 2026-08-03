import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSendableEmail } from "@/lib/email";

// The single source of truth for who receives an issue, so the count shown
// on the send button and the addresses actually mailed can't drift apart.
// Three overlapping pools: the pre-account "get notified" waitlist, explicit
// newsletter subscribers, and every registered account.
export async function getNewsletterRecipients(supabase: SupabaseClient): Promise<string[]> {
  const [waitlistRes, subscriberRes] = await Promise.all([
    supabase.from("waitlist_signups").select("email"),
    supabase.from("newsletter_subscribers").select("email").is("unsubscribed_at", null),
  ]);

  const accountEmails: string[] = [];
  try {
    const admin = createAdminClient();
    let page = 1;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error || !data) break;
      for (const u of data.users) if (u.email) accountEmails.push(u.email);
      if (data.users.length < 1000) break;
      page++;
    }
  } catch (err) {
    // Missing service-role key shouldn't blank out the waitlist/subscribers.
    console.error(`[newsletter] couldn't list account emails: ${err instanceof Error ? err.message : String(err)}`);
  }

  const all = [
    ...((waitlistRes.data ?? []) as { email: string }[]).map((r) => r.email),
    ...((subscriberRes.data ?? []) as { email: string }[]).map((r) => r.email),
    ...accountEmails,
  ];

  return [...new Set(all.map((e) => e.trim().toLowerCase()))].filter(isSendableEmail);
}
