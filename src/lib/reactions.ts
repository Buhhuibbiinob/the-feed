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
