// Reactions on someone's curated top-list picks. A fixed set, not free
// emoji input: a known list is what lets the profile group and count them,
// and it keeps the reaction row a row of buttons rather than a text field.

export const PICK_REACTIONS = [
  { emoji: "🔥", label: "Obsessed too" },
  { emoji: "🪩", label: "Vibe" },
  { emoji: "💔", label: "Wrecked me" },
  { emoji: "👀", label: "Adding this" },
] as const;

export type PickReaction = (typeof PICK_REACTIONS)[number]["emoji"];

const EMOJIS = new Set<string>(PICK_REACTIONS.map((r) => r.emoji));

export function isPickReaction(value: unknown): value is PickReaction {
  return typeof value === "string" && EMOJIS.has(value);
}

export function reactionLabel(emoji: string): string {
  return PICK_REACTIONS.find((r) => r.emoji === emoji)?.label ?? "Reaction";
}

/** Counts per emoji for one pick, in the order the buttons are shown. */
export function tallyReactions(emojis: string[]): { emoji: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const emoji of emojis) counts.set(emoji, (counts.get(emoji) ?? 0) + 1);
  return PICK_REACTIONS.map((r) => ({ emoji: r.emoji, count: counts.get(r.emoji) ?? 0 })).filter(
    (r) => r.count > 0
  );
}

// Reaction tags on reviews. A different set from the top-list ones: these
// describe what a piece of work did to you, which is the vocabulary the
// stars can't carry. Faster to leave than a written review, and the tally
// is what gives a profile its "vibe" without anyone filling in a field.
export const REVIEW_REACTIONS = [
  { emoji: "🔥", label: "Obsessed" },
  { emoji: "💔", label: "Heartbreak" },
  { emoji: "🪩", label: "Vibe" },
  { emoji: "🤯", label: "Floored" },
  { emoji: "😴", label: "Slept on it" },
] as const;

export type ReviewReaction = (typeof REVIEW_REACTIONS)[number]["emoji"];

const REVIEW_EMOJIS = new Set<string>(REVIEW_REACTIONS.map((r) => r.emoji));

export function isReviewReaction(value: unknown): value is ReviewReaction {
  return typeof value === "string" && REVIEW_EMOJIS.has(value);
}

export function reviewReactionLabel(emoji: string): string {
  return REVIEW_REACTIONS.find((r) => r.emoji === emoji)?.label ?? "Reaction";
}

export function tallyReviewReactions(emojis: string[]): { emoji: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const emoji of emojis) counts.set(emoji, (counts.get(emoji) ?? 0) + 1);
  return REVIEW_REACTIONS.map((r) => ({ emoji: r.emoji, count: counts.get(r.emoji) ?? 0 })).filter(
    (r) => r.count > 0
  );
}
