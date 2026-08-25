import type { ReactNode } from "react";

// Bio formatting. Markdown-flavoured on purpose - people already know the
// asterisk convention from every chat app - but parsed into React elements
// rather than HTML, so there is no path from a bio to injected markup no
// matter what someone types. Emoji need no handling; they are just text.
//
// Supported: **bold**, *italic*, __underline__, ~~strike~~, `code`,
// and newlines. Unmatched markers stay as literal characters.

type Marker = { token: string; wrap: (children: ReactNode, key: string) => ReactNode };

// Longest tokens first so ** isn't eaten by the * rule.
const MARKERS: Marker[] = [
  { token: "**", wrap: (c, k) => <strong key={k}>{c}</strong> },
  { token: "__", wrap: (c, k) => <u key={k}>{c}</u> },
  { token: "~~", wrap: (c, k) => <s key={k}>{c}</s> },
  { token: "*", wrap: (c, k) => <em key={k}>{c}</em> },
  { token: "`", wrap: (c, k) => <code key={k}>{c}</code> },
];

function parseInline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let buffer = "";
  let i = 0;

  const flush = () => {
    if (buffer) {
      out.push(buffer);
      buffer = "";
    }
  };

  while (i < text.length) {
    const marker = MARKERS.find((m) => text.startsWith(m.token, i));
    if (marker) {
      const close = text.indexOf(marker.token, i + marker.token.length);
      // A marker with nothing after it, or with an empty body, is just a
      // character someone typed - leave it alone rather than swallowing it.
      if (close > i + marker.token.length) {
        const inner = text.slice(i + marker.token.length, close);
        flush();
        out.push(marker.wrap(parseInline(inner, `${keyPrefix}-${i}i`), `${keyPrefix}-${i}`));
        i = close + marker.token.length;
        continue;
      }
    }
    buffer += text[i];
    i++;
  }

  flush();
  return out;
}

/** Renders a bio's light formatting. Newlines become real line breaks. */
export function renderRichBio(text: string): ReactNode {
  return text.split("\n").flatMap((line, index) => {
    const parsed = parseInline(line, `l${index}`);
    return index === 0 ? parsed : [<br key={`br${index}`} />, ...parsed];
  });
}

export const BIO_FORMATTING_HINT = "**bold**  *italic*  __underline__  ~~strike~~  `code`";
