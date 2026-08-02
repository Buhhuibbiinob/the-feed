// Server-side content filter for direct messages, usernames, and bios. This
// is a first line of defense, not a substitute for the Report/Block tooling
// in the DM thread UI or for human moderation review in /admin - a
// keyword/pattern filter can be evaded by a determined bad actor, so it
// exists alongside those, not instead of them.
//
// DM messages block, in order (first match wins so the user gets one clear
// reason):
//  1. Links/URLs of any kind.
//  2. Contact-info sharing: emails, phone numbers, social handles/usernames,
//     and "add me on X" - style requests to move the conversation elsewhere.
//  3. Sexual content and dating/flirtation solicitation.
//  4. Grooming red flags (asking age, location, to meet up, to keep secrets).
//  5. Bullying/harassment.
//
// Usernames and bios (public-facing identity fields, so held to the same
// no-contact-info bar as DMs) additionally block hateful slurs and profanity.

export type SafetyCheck = { allowed: true } | { allowed: false; reason: string };

const LINK_RE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|io|co|me|ly|gg|tv|link|xyz)\b(?:\/\S*)?/i;

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\s.-]?){7,}/;
const HANDLE_SHARE_RE =
  /\b(instagram|insta|ig|snapchat|snap|discord|telegram|tiktok|whatsapp|kik|onlyfans|facebook|twitter|x\.com)\b\s*[:@]?\s*[a-z0-9._]{2,}|@[a-z0-9._]{3,}|\b(add|find|follow|hit|message|dm)\s+me\s+(on|at)\b|\bmy\s+(number|snap|insta|discord|username|handle)\s+is\b/i;

const SEXUAL_DATING_RE =
  /\b(nudes?|sexting|send\s*(a\s*)?nude|horny|hook\s*up|hookup|dtf|be\s+my\s+(girlfriend|boyfriend|gf|bf)|wanna\s+date|will\s+you\s+date\s+me|are\s+you\s+single|you'?re\s+(so\s+)?(hot|sexy|cute)\s|f[\s*_-]?u[\s*_-]?c[\s*_-]?k\s+me|sex\s+chat)\b/i;

const GROOMING_RE =
  /\b(how\s+old\s+are\s+you|what'?s\s+your\s+age|where\s+do\s+you\s+live|what\s+school\s+do\s+you\s+go|send\s+(a\s+)?pic(ture)?\s+of\s+yourself|meet\s+(up|in\s+person)|let'?s\s+meet|don'?t\s+tell\s+(your\s+)?(parents|mom|dad)|keep\s+this\s+(a\s+)?secret|our\s+little\s+secret|are\s+your\s+parents\s+home)\b/i;

const BULLYING_RE =
  /\b(kill\s*your\s*self|kys|you'?re\s+(worthless|pathetic|ugly|stupid|a\s+loser|disgusting)|nobody\s+likes\s+you|go\s+die|i\s+hate\s+you\s+so\s+much)\b/i;

// Collapses separators a filter-evader might insert between letters
// ("s.n.a.p.c.h.a.t", "k i k") so single-token checks still catch it. Only
// applied to the handle/sexual/bullying single-word checks below, not the
// phrase-based ones above (which need real word boundaries/spacing).
function collapseSeparators(text: string): string {
  return text.toLowerCase().replace(/[\s._*-]+/g, "");
}

const COLLAPSED_BLOCKLIST = [
  "snapchat",
  "instagram",
  "whatsapp",
  "telegram",
  "onlyfans",
  "kik",
  "discord",
];

// General profanity - allowed in reviews and live chat (cussing in a review
// is fine), but still blocked in usernames/bios/DMs alongside the hate list
// below.
const GENERAL_PROFANITY_TOKENS = [
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "whore",
  "slut",
  "asshole",
  "bastard",
  "dick",
  "pussy",
];

// Hateful slurs/severe terms - blocked everywhere, including reviews and
// live chat where general profanity is otherwise allowed. Checked against
// the separator-collapsed text so common evasions ("f.u.c.k", spaced-out
// letters) still match. Starting set covering the most common severe
// terms - expand this list as real reports come in from the Report button
// rather than trying to enumerate every variant up front.
const HATE_SLUR_TOKENS = [
  "nigger",
  "nigga",
  "faggot",
  "fag",
  "retard",
  "retarded",
  "spic",
  "chink",
  "kike",
  "tranny",
  "rape",
  "rapist",
  "pedo",
  "pedophile",
  "nazi",
  "hitler",
];

const HATE_PHRASE_RE =
  /\b(kill\s+all\s+\w+|go\s+back\s+to\s+your\s+country|all\s+\w+\s+should\s+die|white\s+power|black\s+power\s+kill|kill\s*your\s*self|kys|nobody\s+likes\s+you|go\s+die)\b/i;

const PHONE_ONLY_RE = /(?:\+?\d[\s.-]?){7,}/;

function containsHateSpeech(text: string): boolean {
  const collapsed = collapseSeparators(text);
  return HATE_SLUR_TOKENS.some((word) => collapsed.includes(word)) || HATE_PHRASE_RE.test(text);
}

function containsProfanityOrHate(text: string): boolean {
  const collapsed = collapseSeparators(text);
  return (
    GENERAL_PROFANITY_TOKENS.some((word) => collapsed.includes(word)) ||
    HATE_SLUR_TOKENS.some((word) => collapsed.includes(word)) ||
    HATE_PHRASE_RE.test(text)
  );
}

// "Just a letter" / low-effort junk: a single character, a run of the same
// character repeated, or a string with no letters at all (punctuation mash).
const LOW_EFFORT_RE = /^(.)\1*$/;

function isLowEffort(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return true;
  if (LOW_EFFORT_RE.test(trimmed.replace(/\s+/g, ""))) return true;
  if (!/[a-zA-Z]/.test(trimmed)) return true;
  return false;
}

// Usernames: letters, numbers, underscore, period only, 3-20 chars. Keeps
// out zero-width/lookalike-unicode spoofing tricks and, as a side effect,
// makes the word filter above impossible to dodge by sprinkling symbols
// between letters (there are no symbols left to sprinkle).
const USERNAME_CHARSET_RE = /^[a-zA-Z0-9._]{3,20}$/;

export function checkUsernameSafety(username: string): SafetyCheck {
  if (!USERNAME_CHARSET_RE.test(username)) {
    return {
      allowed: false,
      reason: "Usernames can only contain letters, numbers, periods, and underscores (3-20 characters).",
    };
  }
  if (containsProfanityOrHate(username)) {
    return { allowed: false, reason: "That username isn't allowed. Please choose another." };
  }
  if (PHONE_ONLY_RE.test(username)) {
    return { allowed: false, reason: "Usernames can't be phone numbers." };
  }
  return { allowed: true };
}

export function checkBioSafety(bio: string): SafetyCheck {
  const trimmed = bio.trim();
  if (!trimmed) return { allowed: true };

  if (LINK_RE.test(trimmed)) {
    return { allowed: false, reason: "Bios can't include links." };
  }
  if (EMAIL_RE.test(trimmed) || PHONE_ONLY_RE.test(trimmed) || HANDLE_SHARE_RE.test(trimmed)) {
    return {
      allowed: false,
      reason: "Bios can't include phone numbers, emails, or social media handles/usernames.",
    };
  }
  if (containsProfanityOrHate(trimmed)) {
    return { allowed: false, reason: "That bio isn't allowed. Please remove any profanity or hateful language." };
  }
  return { allowed: true };
}

export function checkMessageSafety(text: string): SafetyCheck {
  const trimmed = text.trim();
  const collapsed = collapseSeparators(trimmed);

  if (LINK_RE.test(trimmed)) {
    return { allowed: false, reason: "Messages can't include links." };
  }
  if (EMAIL_RE.test(trimmed) || PHONE_RE.test(trimmed) || HANDLE_SHARE_RE.test(trimmed)) {
    return {
      allowed: false,
      reason: "Messages can't include phone numbers, emails, or social media handles/usernames.",
    };
  }
  if (COLLAPSED_BLOCKLIST.some((word) => collapsed.includes(word))) {
    return {
      allowed: false,
      reason: "Messages can't include phone numbers, emails, or social media handles/usernames.",
    };
  }
  if (SEXUAL_DATING_RE.test(trimmed)) {
    return { allowed: false, reason: "Messages can't include sexual, dating, or flirtatious content." };
  }
  if (GROOMING_RE.test(trimmed)) {
    return {
      allowed: false,
      reason: "That message was blocked for everyone's safety. Please keep conversations here appropriate.",
    };
  }
  if (BULLYING_RE.test(trimmed)) {
    return { allowed: false, reason: "Messages can't include bullying or harassment." };
  }

  return { allowed: true };
}

// Reviews and live chat hold cussing to a lower bar than DMs/usernames -
// general profanity is fine, but hateful slurs, harassment, and low-effort
// "just a letter" junk responses still aren't.
export function checkReviewSafety(text: string): SafetyCheck {
  const trimmed = text.trim();
  if (isLowEffort(trimmed)) {
    return { allowed: false, reason: "Write a real review - not just a single character or symbols." };
  }
  if (containsHateSpeech(trimmed)) {
    return { allowed: false, reason: "Reviews can't include hateful language or slurs." };
  }
  if (BULLYING_RE.test(trimmed)) {
    return { allowed: false, reason: "Reviews can't include bullying or harassment." };
  }
  return { allowed: true };
}

export function checkChatSafety(text: string): SafetyCheck {
  const trimmed = text.trim();
  if (isLowEffort(trimmed)) {
    return { allowed: false, reason: "Write a real message - not just a single character or symbols." };
  }
  if (containsHateSpeech(trimmed)) {
    return { allowed: false, reason: "Chat can't include hateful language or slurs." };
  }
  if (BULLYING_RE.test(trimmed)) {
    return { allowed: false, reason: "Chat can't include bullying or harassment." };
  }
  return { allowed: true };
}
