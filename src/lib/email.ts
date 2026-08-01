import { Resend } from "resend";

export type SendEmailResult = { ok: true; sent: number } | { ok: false; error: string; sent?: number };

const BATCH_SIZE = 100;

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

  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM_EMAIL || "Feedback <onboarding@resend.dev>";

  let sent = 0;
  for (let i = 0; i < toEmails.length; i += BATCH_SIZE) {
    const chunk = toEmails.slice(i, i + BATCH_SIZE);
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
