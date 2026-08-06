import { Resend } from "resend";

export type SendEmailResult = { ok: true; sent: number } | { ok: false; error: string; sent?: number };

const BATCH_SIZE = 100;

// mythefeed.com is verified in Resend (DKIM + SPF), so mail goes out as the
// real brand rather than the shared onboarding@resend.dev sandbox domain.
//
// Two distinct senders, deliberately NOT sharing one variable. They used to
// both read RESEND_FROM_EMAIL, which meant whatever that held won for every
// message - so sign-in links went out as "newsletter" and newsletters went
// out as "hello". A password reset arriving from a newsletter address also
// reads as marketing and gets filtered with it, which is the last thing
// that should happen to a reset link.
//
// Note "Enable Receiving" is off in Resend, so neither address accepts
// replies - no email should invite one until inbound is turned on.
export const FROM_TRANSACTIONAL =
  process.env.RESEND_FROM_TRANSACTIONAL || "Feedback <hello@mythefeed.com>";
export const FROM_NEWSLETTER =
  process.env.RESEND_FROM_NEWSLETTER || "Feedback <newsletter@mythefeed.com>";

// RFC2606 reserved domains and the like: these can never receive mail, and
// Resend rejects them outright. A batch send fails as a whole if any single
// recipient is invalid, so one leftover test address would otherwise block
// the entire list.
const UNDELIVERABLE_RE = /@(example|test|invalid|localhost)\.(com|org|net|invalid)$|@localhost$|\.invalid$/i;

export function isSendableEmail(email: string): boolean {
  const trimmed = email?.trim() ?? "";
  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return false;
  return !UNDELIVERABLE_RE.test(trimmed);
}

// Single transactional send (confirmation, welcome). Kept separate from the
// bulk path so a newsletter blast can't be confused with a per-user email.
export async function sendEmail(
  subject: string,
  html: string,
  toEmail: string,
  options: { from?: string } = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY isn't set." };

  const resend = new Resend(apiKey);
  const from = options.from ?? FROM_TRANSACTIONAL;

  try {
    const { error } = await resend.emails.send({ from, to: toEmail, subject, html });
    if (error) return { ok: false, error: error.message || "Resend rejected the request." };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendBulkEmail(
  subject: string,
  html: string,
  toEmails: string[]
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "RESEND_API_KEY isn't set. Add it (and optionally RESEND_FROM_EMAIL) to your environment variables to enable sending.",
    };
  }
  if (toEmails.length === 0) {
    return { ok: false, error: "No subscribers to send to yet." };
  }

  // Drop addresses that can never be delivered before batching. Resend
  // rejects the whole batch if a single recipient is invalid, so one
  // leftover test address would otherwise stop the entire send.
  const recipients = toEmails.filter(isSendableEmail);
  if (recipients.length === 0) {
    return {
      ok: false,
      error: `None of the ${toEmails.length} addresses on file can receive mail (they're all test or malformed addresses).`,
    };
  }

  const resend = new Resend(apiKey);
  const from = FROM_NEWSLETTER;

  let sent = 0;
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE);
    const { error } = await resend.batch.send(
      chunk.map((email) => ({ from, to: email, subject, html }))
    );
    if (error) {
      return { ok: false, error: error.message || "Resend rejected the request.", sent };
    }
    sent += chunk.length;
  }

  return { ok: true, sent };
}
