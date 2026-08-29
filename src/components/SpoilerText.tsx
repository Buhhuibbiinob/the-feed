"use client";

import { Fragment, useState } from "react";
import { renderEmojiText } from "@/lib/emojiText";

export function SpoilerText({ text }: { text: string }) {
  // Built fresh per render. A shared /g regex carries lastIndex between
  // calls, so one module-level copy meant every post on the page walking
  // over the same cursor - and resetting it was a mutation of shared
  // state during render.
  const pattern = /\|\|([\s\S]+?)\|\|/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <Fragment key={key++}>{renderEmojiText(text.slice(lastIndex, match.index))}</Fragment>
      );
    }
    parts.push(<Spoiler key={key++}>{match[1]}</Spoiler>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(<Fragment key={key++}>{renderEmojiText(text.slice(lastIndex))}</Fragment>);
  }
  return <>{parts}</>;
}

function Spoiler({ children }: { children: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      className={`spoiler${revealed ? " revealed" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => setRevealed(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") setRevealed(true);
      }}
    >
      {renderEmojiText(children)}
    </span>
  );
}
