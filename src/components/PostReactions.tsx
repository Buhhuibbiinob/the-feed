"use client";

import { useRef, useState } from "react";
import { ClassicEmoji, EMOJI_GROUPS, emojiLabel } from "@/components/ClassicEmoji";
import { reactToPost } from "@/app/actions/reactions";
import { Portal } from "@/components/Portal";

/**
 * Reactions on a review.
 *
 * A like says "yes". A reaction says which yes it was, which on a site
 * about how things made you feel is most of the point. The quick row is
 * six, because a picker that opens for the common case is friction; the
 * full keyboard is one tap further for anyone who wants the exact one.
 */
const QUICK = [
  "\u{1F602}", // laughing
  "\u{1F622}", // crying
  "\u{1F92F}", // mind blown
  "\u{2764}", // heart
  "\u{1F3A7}", // headphones - "this is going in my rotation"
  "\u{1F918}", // rock on
];

export type ReactionCount = { emoji: string; count: number };

export function PostReactions({
  postId,
  counts,
  mine,
  signedIn,
}: {
  postId: string;
  counts: ReactionCount[];
  mine: string | null;
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<{ left: number; top: number; bottom: number } | null>(null);

  function toggle() {
    const box = moreRef.current?.getBoundingClientRect();
    if (box) setAt({ left: box.left, top: box.top, bottom: box.bottom });
    setOpen((v) => !v);
  }

  function send(emoji: string) {
    const data = new FormData();
    data.set("post_id", postId);
    // Tapping the one you already picked takes it back, which is what
    // every reaction row anywhere does.
    data.set("emoji", emoji === mine ? "" : emoji);
    void reactToPost(data);
    setOpen(false);
  }

  const picked = new Set(counts.map((c) => c.emoji));
  const quick = QUICK.filter((e) => !picked.has(e));

  return (
    <div className="post-reactions">
      {counts.map((c) => (
        <button
          type="button"
          key={c.emoji}
          className={`reaction-chip${c.emoji === mine ? " mine" : ""}`}
          onClick={() => signedIn && send(c.emoji)}
          disabled={!signedIn}
          aria-label={`${emojiLabel(c.emoji)}, ${c.count}`}
          aria-pressed={c.emoji === mine}
        >
          <ClassicEmoji char={c.emoji} size={16} />
          <span>{c.count}</span>
        </button>
      ))}

      {signedIn && (
        <>
          {quick.slice(0, counts.length > 0 ? 3 : 6).map((emoji) => (
            <button
              type="button"
              key={emoji}
              className="reaction-chip add"
              onClick={() => send(emoji)}
              aria-label={`React ${emojiLabel(emoji)}`}
            >
              <ClassicEmoji char={emoji} size={16} />
            </button>
          ))}
          <button
            type="button"
            ref={moreRef}
            className="reaction-chip more"
            onClick={toggle}
            aria-expanded={open}
            aria-label="More reactions"
          >
            +
          </button>
        </>
      )}

      {open && at && (
        /* Portaled and fixed, not absolute inside the card.
           .panel-body is `overflow: hidden` - it has to be, that is what
           rounds the card's corners - so an absolutely positioned picker
           was being CLIPPED at the bottom edge of the review. It looked
           like the next post was drawn on top of it; it was actually
           never painted below the card at all. */
        <Portal>
          <button
            type="button"
            className="reaction-scrim"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div
            className="reaction-pop"
            style={
              // Below the button when there is room, above it when the
              // review is near the bottom of the window.
              at.bottom + 300 < window.innerHeight
                ? { left: Math.max(8, Math.min(at.left, window.innerWidth - 324)), top: at.bottom + 6 }
                : {
                    left: Math.max(8, Math.min(at.left, window.innerWidth - 324)),
                    bottom: window.innerHeight - at.top + 6,
                  }
            }
          >
            {/* The site's whole set, so a reaction can be as specific as
                the thing being reviewed deserves. */}
            <ReactionPicker onPick={send} />
          </div>
        </Portal>
      )}
    </div>
  );
}

/** The same groups the typing keyboard uses, so the two can never drift. */
function ReactionPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [group, setGroup] = useState(0);

  return (
    <>
      <div className="seg emoji-kb-tabs">
        {EMOJI_GROUPS.map((g, i) => (
          <button
            type="button"
            key={g.name}
            className={`seg-item${group === i ? " active" : ""}`}
            onClick={() => setGroup(i)}
          >
            {g.name}
          </button>
        ))}
      </div>
      <div className="emoji-kb-grid">
        {EMOJI_GROUPS[group].chars.map((char) => (
          <button
            type="button"
            key={char}
            className="emoji-key"
            onClick={() => onPick(char)}
            title={emojiLabel(char)}
            aria-label={emojiLabel(char)}
          >
            <ClassicEmoji char={char} size={24} />
          </button>
        ))}
      </div>
    </>
  );
}
