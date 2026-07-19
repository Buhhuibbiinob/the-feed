"use client";

import { Fragment, useState } from "react";

const SPOILER_PATTERN = /\|\|([\s\S]+?)\|\|/g;

export function SpoilerText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  SPOILER_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SPOILER_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<Fragment key={key++}>{text.slice(lastIndex, match.index)}</Fragment>);
    }
    parts.push(<Spoiler key={key++}>{match[1]}</Spoiler>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(<Fragment key={key++}>{text.slice(lastIndex)}</Fragment>);
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
      {children}
    </span>
  );
}
