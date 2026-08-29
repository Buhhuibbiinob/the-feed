/**
 * Custom CSS for a profile - the thing that actually made Myspace what
 * it was, and the only honest answer to "unlimited customisation".
 *
 * Letting members write CSS that lands in a page everyone else loads is
 * a real risk, so this is not a filter of bad words - it rewrites the
 * stylesheet into a shape that cannot reach outside the profile:
 *
 *  1. Every selector is prefixed with the profile's own scope, so a
 *     rule can only ever match inside the member's page. Without this
 *     someone could restyle the nav bar into a fake sign-in prompt on a
 *     page anyone can visit.
 *  2. `</style>` and `<` are removed. The result is injected into a
 *     <style> element, and a closing tag inside it ends the stylesheet
 *     early and turns the rest into live HTML - which is a script
 *     injection, not a styling bug.
 *  3. `position: fixed` is dropped. Fixed means "cover the window",
 *     which is how a decorated page becomes a full-screen overlay on
 *     top of the real UI.
 *  4. @import is dropped - it fetches a stylesheet we never reviewed,
 *     from anywhere.
 *  5. The old script-in-CSS vectors go: javascript:, expression(),
 *     behavior:, -moz-binding.
 *
 * What is deliberately allowed: colours, fonts, borders, gradients,
 * transforms, animations, and background images from any URL. Loading
 * an image from another host is the entire point of a decorated page,
 * and the profile is public anyway, so there is nothing there to leak
 * that a visitor cannot already see.
 */

export const MAX_PROFILE_CSS = 8000;

const BANNED_VALUE = /(javascript\s*:|expression\s*\(|behaviou?r\s*:|-moz-binding|position\s*:\s*fixed)/gi;

/** At-rules whose body is more rules, so the scope has to go inside. */
const NESTS = /^@(media|supports|container|layer)\b/i;
/** At-rules whose body is not selectors and must be left alone. */
const VERBATIM = /^@(keyframes|-webkit-keyframes|font-face|counter-style|property)\b/i;
/** At-rules that reach outside the page entirely. */
const FORBIDDEN = /^@(import|charset|namespace|document)\b/i;

function scopeSelector(selector: string, scope: string): string {
  return selector
    .split(",")
    .map((part) => {
      const s = part.trim();
      if (!s) return "";
      // `:root` and `html`/`body` are attempts - intentional or not - to
      // style the whole document. They become the profile itself.
      if (/^(:root|html|body)$/i.test(s)) return scope;
      return `${scope} ${s}`;
    })
    .filter(Boolean)
    .join(", ");
}

/** Splits a block into top-level rules, respecting nesting and strings. */
function splitRules(css: string): { prelude: string; body: string | null }[] {
  const out: { prelude: string; body: string | null }[] = [];
  let depth = 0;
  let start = 0;
  let bodyStart = -1;
  let quote: string | null = null;

  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (quote) {
      if (c === quote && css[i - 1] !== "\\") quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (c === "{") {
      if (depth === 0) bodyStart = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) {
        out.push({
          prelude: css.slice(start, bodyStart).trim(),
          body: css.slice(bodyStart + 1, i),
        });
        start = i + 1;
        bodyStart = -1;
      }
    } else if (c === ";" && depth === 0) {
      // A statement at-rule such as @import, which has no block.
      out.push({ prelude: css.slice(start, i).trim(), body: null });
      start = i + 1;
    }
  }
  return out.filter((r) => r.prelude || r.body);
}

function scopeBlock(css: string, scope: string): string {
  return splitRules(css)
    .map(({ prelude, body }) => {
      if (FORBIDDEN.test(prelude)) return "";
      if (body === null) return ""; // any other bodyless at-rule
      if (VERBATIM.test(prelude)) return `${prelude}{${body}}`;
      if (NESTS.test(prelude)) return `${prelude}{${scopeBlock(body, scope)}}`;
      const selector = scopeSelector(prelude, scope);
      if (!selector) return "";
      return `${selector}{${body}}`;
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * Returns CSS safe to drop into a <style> tag, or "" if there is
 * nothing usable. Never throws: a member pasting broken CSS should get
 * a plain page, not an error page.
 */
export function sanitizeProfileCss(raw: string | null | undefined, scope: string): string {
  if (!raw) return "";
  try {
    let css = raw.slice(0, MAX_PROFILE_CSS);
    // Comments first, so nothing can hide inside one.
    css = css.replace(/\/\*[\s\S]*?\*\//g, " ");
    // Anything that could close the tag or start an element.
    css = css.replace(/</g, " ");
    css = css.replace(BANNED_VALUE, " ");
    return scopeBlock(css, scope);
  } catch {
    return "";
  }
}
