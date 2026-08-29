import type { ReactNode } from "react";
import { ALL_EMOJI, ClassicEmoji } from "@/components/ClassicEmoji";

/**
 * Swaps the emoji inside a string for the site's own artwork.
 *
 * A textarea can only ever draw text with a font, so while you are
 * typing, the operating system's emoji is what you see - there is no way
 * to put an image inside a textarea, on any browser. What matters is
 * everything else: the moment that text is displayed - a review, a
 * comment, a guestbook entry, an alert, a message - it is ordinary
 * markup, and the character can be drawn however we like.
 *
 * So this is the other half of the emoji keyboard. Without it, picking a
 * classic smiley put a plain codepoint in the database and every reader
 * saw whatever their phone draws, which is exactly the flat modern set
 * the drawn ones exist to avoid.
 *
 * Text in, React elements out - never HTML - so there is no path from
 * something a member typed to injected markup.
 */

// One alternation of every character the site draws, longest first so a
// sequence with a variation selector matches before its bare base.
const SOURCE = `(${[...ALL_EMOJI]
  .sort((a, b) => b.length - a.length)
  .map((char) => char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|")})\uFE0F?`;

// Built once without /g for testing, and fresh per call for scanning.
// A single shared /g regex carries lastIndex between calls, so two posts
// on the same page would walk over one cursor and the second would start
// reading from wherever the first stopped - the same trap SpoilerText
// documents. Resetting it would be a mutation of shared state during
// render, which is worse.
const PROBE = new RegExp(SOURCE, "u");

const KNOWN = new Set(ALL_EMOJI);

/**
 * True when a string contains something we draw. Checked first so the
 * common case - text with no emoji at all - is a single scan rather than
 * a split and a rebuild.
 */
export function hasDrawnEmoji(text: string): boolean {
  return PROBE.test(text);
}

export function renderEmojiText(text: string, size = 18, keyPrefix = "e"): ReactNode[] {
  if (!hasDrawnEmoji(text)) return [text];

  const pattern = new RegExp(SOURCE, "gu");
  const out: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const char = match[1];
    out.push(
      <span className="emoji-inline" key={`${keyPrefix}-${match.index}`}>
        <ClassicEmoji char={char} size={size} />
      </span>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/**
 * The same thing as a component, for the many render sites that just
 * want to drop a string in.
 */
export function EmojiText({
  children,
  size = 18,
}: {
  children: string | null | undefined;
  size?: number;
}) {
  if (!children) return null;
  return <>{renderEmojiText(children, size)}</>;
}

export function isDrawnEmoji(char: string): boolean {
  return KNOWN.has(char) || KNOWN.has(char.replace(/️/g, ""));
}
