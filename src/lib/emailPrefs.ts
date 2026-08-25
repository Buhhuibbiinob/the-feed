// What a member wants emailed, and how often.
//
// Three settings per type rather than a single on/off: "off" and "every
// single one" are both bad defaults for a site where a popular review can
// draw thirty likes in an evening. Digest is the middle option and the
// default.

export const EMAIL_MODES = ["off", "digest", "instant"] as const;
export type EmailMode = (typeof EMAIL_MODES)[number];

export const EMAIL_MODE_LABELS: Record<EmailMode, string> = {
  off: "Never",
  digest: "In a digest",
  instant: "Straight away",
};

export const EMAIL_EVENTS = [
  { key: "follow", label: "Someone follows you" },
  { key: "like", label: "Someone likes your review" },
  { key: "reply", label: "Someone replies to you" },
] as const;

export type EmailEventKey = (typeof EMAIL_EVENTS)[number]["key"];

export type EmailPrefs = Record<EmailEventKey, EmailMode>;

// Follows are rare and personal, so they're worth an immediate mail.
// Likes are frequent and individually low-information, so they batch.
export const DEFAULT_EMAIL_PREFS: EmailPrefs = {
  follow: "digest",
  like: "digest",
  reply: "digest",
};

export function isEmailMode(value: unknown): value is EmailMode {
  return typeof value === "string" && (EMAIL_MODES as readonly string[]).includes(value);
}

/** Reads the stored blob, falling back per key so a partial record works. */
export function resolveEmailPrefs(stored: unknown): EmailPrefs {
  const source = (stored ?? {}) as Record<string, unknown>;
  const prefs = { ...DEFAULT_EMAIL_PREFS };
  for (const event of EMAIL_EVENTS) {
    const value = source[event.key];
    if (isEmailMode(value)) prefs[event.key] = value;
  }
  return prefs;
}

export function wantsDigest(prefs: EmailPrefs): boolean {
  return EMAIL_EVENTS.some((e) => prefs[e.key] === "digest");
}
