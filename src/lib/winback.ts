import type { SupabaseClient } from "@supabase/supabase-js";
import { emailsByUserId, type DigestResult } from "@/lib/digest";
import { renderWinbackEmail } from "@/lib/emailTemplates";
import { sendEmail, isSendableEmail } from "@/lib/email";
import { resolveNudgePref } from "@/lib/emailPrefs";
import { currentPrompt } from "@/lib/weeklyPrompt";
import { chooseNextStep } from "@/lib/afterPost";
import { siteUrl } from "@/lib/site";

// The win-back nudge: one email to somebody who posted and then stopped.
//
// A separate channel from the digest on purpose, and the distinction is
// the whole reason this exists. The digest is built from getNotifications
// - follows, likes, replies, reactions - so every line in it requires
// another person to have acted on you first. A member with one review and
// no followers generates none of those, so sendDigests finds nothing to
// say and skips them. Forever. The people the site most needs to hear
// from are the only ones it structurally cannot contact.
//
// This is triggered by absence instead, which is a fact about their own
// row and needs nobody else's participation. If it were folded into the
// digest it would inherit "skip when there is nothing to report", which
// is the exact rule that makes the digest unable to reach them.

/** How long somebody has to be quiet before a nudge is fair. */
export const QUIET_DAYS = 7;
/** How long after a nudge before another is fair. */
export const COOLDOWN_DAYS = 30;
/** How many an account can ever get. After this it is not working. */
export const MAX_NUDGES = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export type NudgeCandidate = {
  id: string;
  username: string;
  /** When they last posted a review. Null means they never have. */
  lastPostAt: string | null;
  nudgeSentAt: string | null;
  nudgeCount: number;
  /** When the digest last reached them, if ever. */
  digestSentAt: string | null;
  optedOut: boolean;
};

/**
 * Whether this member should get a nudge right now.
 *
 * Pure, and separated from the sending, because every rule in here is a
 * rule about not being a nuisance - and the cost of getting one wrong is
 * mailing a real person something they didn't ask for. Tested in
 * scripts/winback-check.ts.
 */
export function shouldNudge(member: NudgeCandidate, now: Date = new Date()): boolean {
  if (member.optedOut) return false;

  // Never posted: this is not a win-back, it is a cold email to somebody
  // who signed up and looked around. Different problem, different
  // permission, not this.
  if (!member.lastPostAt) return false;

  const quietFor = now.getTime() - new Date(member.lastPostAt).getTime();
  if (quietFor < QUIET_DAYS * DAY_MS) return false;

  if (member.nudgeCount >= MAX_NUDGES) return false;

  if (member.nudgeSentAt) {
    const sinceLast = now.getTime() - new Date(member.nudgeSentAt).getTime();
    if (sinceLast < COOLDOWN_DAYS * DAY_MS) return false;
  }

  // Somebody the digest has just written to is not out of contact - they
  // are getting mail about real activity, and a "we miss you" on top of
  // it reads as a machine that isn't paying attention.
  if (member.digestSentAt) {
    const sinceDigest = now.getTime() - new Date(member.digestSentAt).getTime();
    if (sinceDigest < QUIET_DAYS * DAY_MS) return false;
  }

  return true;
}

type NudgeRow = {
  id: string;
  username: string;
  avatar_url: string | null;
  banner_url: string | null;
  email_prefs: unknown;
  nudge_sent_at: string | null;
  nudge_count: number | null;
  digest_sent_at: string | null;
};

/**
 * Sends the nudges that are due.
 *
 * Same shape and same result type as sendDigests, so the two jobs can be
 * pointed at the same scheduler and read the same way.
 */
export async function sendWinbacks(
  supabase: SupabaseClient,
  { limit = 200, now = new Date() }: { limit?: number; now?: Date } = {}
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
    .select("id, username, avatar_url, banner_url, email_prefs, nudge_sent_at, nudge_count, digest_sent_at")
    .eq("is_bot", false)
    .eq("banned", false)
    .limit(limit)
    .returns<NudgeRow[]>();

  for (const member of memberRows ?? []) {
    const email = emails.get(member.id);
    if (!email || !isSendableEmail(email)) {
      result.skipped++;
      continue;
    }

    // Their own last review, and how many reviews the site has posted
    // since it - the one honest thing a nudge can say that isn't "come
    // back please".
    const { data: lastPost } = await supabase
      .from("posts")
      .select("created_at")
      .eq("user_id", member.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ created_at: string }>();

    const candidate: NudgeCandidate = {
      id: member.id,
      username: member.username,
      lastPostAt: lastPost?.created_at ?? null,
      nudgeSentAt: member.nudge_sent_at,
      nudgeCount: member.nudge_count ?? 0,
      digestSentAt: member.digest_sent_at,
      optedOut: !resolveNudgePref(member.email_prefs),
    };

    if (!shouldNudge(candidate, now)) {
      result.skipped++;
      continue;
    }

    const { count: newReviews } = await supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .gt("created_at", candidate.lastPostAt as string);

    // The same ladder the post confirmation uses, so the email asks for
    // the same thing the site would ask for if they were looking at it.
    // No club here: a club they founded weeks ago is not news.
    const next = chooseNextStep({
      username: member.username,
      hasAvatar: !!member.avatar_url,
      hasBanner: !!member.banner_url,
      reviewCount: 2,
      club: null,
      foundedClub: false,
    });

    const { prompt } = currentPrompt(now);
    const since = newReviews ?? 0;
    const subject =
      since > 0 ? `${since} review${since === 1 ? "" : "s"} since you last posted` : "Your page is still here";

    const sendResult = await sendEmail(
      subject,
      renderWinbackEmail(member.username, {
        newReviews: since,
        question: prompt.question,
        next,
        siteUrl: base,
        settingsUrl: `${base}/settings`,
      }),
      email
    );

    if (sendResult.ok) {
      result.sent++;
      await supabase
        .from("profiles")
        .update({
          nudge_sent_at: now.toISOString(),
          nudge_count: candidate.nudgeCount + 1,
        })
        .eq("id", member.id);
    } else {
      result.errors.push(`${member.username}: ${sendResult.error}`);
    }
  }

  return result;
}
