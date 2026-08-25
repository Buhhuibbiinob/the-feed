import type { SupabaseClient } from "@supabase/supabase-js";
import { getNotifications } from "@/lib/notifications";
import { describeAlert, type AlertItem } from "@/lib/alertText";
import { renderDigestEmail, type DigestLine } from "@/lib/emailTemplates";
import { sendEmail, isSendableEmail } from "@/lib/email";
import { resolveEmailPrefs, type EmailEventKey, type EmailPrefs } from "@/lib/emailPrefs";
import { siteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

// The activity digest: one email per member covering what happened since
// their last one.

export type DigestResult = { sent: number; skipped: number; errors: string[] };

// Alert types map onto the three things a member can have an opinion
// about. Anything not listed here is never emailed at all - profile views
// and taste-twin changes are interesting in the app and creepy in an inbox.
const EVENT_FOR_TYPE: Partial<Record<AlertItem["type"], EmailEventKey>> = {
  follow: "follow",
  like: "like",
  post_reaction: "like",
  comment: "reply",
  reply: "reply",
  reaction: "reply",
};

/** Escapes text that came from another member before it goes into HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function linesFor(items: AlertItem[], prefs: EmailPrefs, since: Date, base: string): DigestLine[] {
  return items
    .filter((item) => {
      const event = EVENT_FOR_TYPE[item.type];
      if (!event) return false;
      if (prefs[event] !== "digest") return false;
      return new Date(item.createdAt).getTime() > since.getTime();
    })
    .slice(0, 25)
    .map((item) => ({
      text: `${escapeHtml(item.actorUsername)} ${escapeHtml(describeAlert(item))}`,
      href: item.postId ? `${base}/post/${item.postId}` : `${base}/profile/${item.actorUsername}`,
    }));
}

type MemberRow = {
  id: string;
  username: string;
  email_prefs: unknown;
  digest_sent_at: string | null;
};

/**
 * Addresses live in auth.users, not in profiles, so they come from the
 * service-role client - the same route the newsletter already uses. A
 * missing service key means no digests rather than a crash.
 */
async function emailsByUserId(): Promise<Map<string, string>> {
  const byId = new Map<string, string>();
  try {
    const admin = createAdminClient();
    let page = 1;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error || !data) break;
      for (const u of data.users) if (u.email) byId.set(u.id, u.email);
      if (data.users.length < 1000) break;
      page++;
    }
  } catch (err) {
    console.error(
      `[digest] couldn't list account emails: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  return byId;
}

/**
 * Sends one digest per member who has something to hear about.
 *
 * Deliberately does nothing for a member with no new activity: an empty
 * "here's what you missed" is the fastest way to teach people to ignore
 * the sender. digest_sent_at only moves when a mail actually goes out, so
 * a quiet week accumulates rather than being skipped over.
 */
export async function sendDigests(
  supabase: SupabaseClient,
  { limit = 200 }: { limit?: number } = {}
): Promise<DigestResult> {
  const base = siteUrl();
  const result: DigestResult = { sent: 0, skipped: 0, errors: [] };

  const emails = await emailsByUserId();
  if (emails.size === 0) {
    result.errors.push("No account emails available - is SUPABASE_SERVICE_ROLE_KEY set?");
    return result;
  }

  const { data: memberRows } = await supabase
    .from("profiles")
    .select("id, username, email_prefs, digest_sent_at")
    .eq("is_bot", false)
    .eq("banned", false)
    .limit(limit)
    .returns<MemberRow[]>();

  for (const member of memberRows ?? []) {
    const email = emails.get(member.id);
    if (!email || !isSendableEmail(email)) {
      result.skipped++;
      continue;
    }

    const prefs = resolveEmailPrefs(member.email_prefs);
    // Everything set to off or instant means there is no digest to send.
    if (!Object.values(prefs).includes("digest")) {
      result.skipped++;
      continue;
    }

    // First digest covers the last day rather than all history, so nobody
    // gets a wall of text the day this ships.
    const since = member.digest_sent_at
      ? new Date(member.digest_sent_at)
      : new Date(Date.now() - 24 * 60 * 60 * 1000);

    const items = (await getNotifications(supabase, member.id, since)) as AlertItem[];
    const lines = linesFor(items, prefs, since, base);
    if (lines.length === 0) {
      result.skipped++;
      continue;
    }

    const sendResult = await sendEmail(
      lines.length === 1 ? "You have a new alert on Feedback" : `${lines.length} new alerts on Feedback`,
      renderDigestEmail(member.username, lines, base, `${base}/settings`),
      email
    );

    if (sendResult.ok) {
      result.sent++;
      await supabase
        .from("profiles")
        .update({ digest_sent_at: new Date().toISOString() })
        .eq("id", member.id);
    } else {
      result.errors.push(`${member.username}: ${sendResult.error}`);
    }
  }

  return result;
}
