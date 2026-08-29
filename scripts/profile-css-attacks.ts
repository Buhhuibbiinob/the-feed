/**
 * Adversarial tests for the profile CSS sanitiser.
 *
 * This is the one place members supply code that lands in a page other
 * people load, so it is tested by attacking it rather than by reading
 * it. Every case below is a real way to get out of a scoped stylesheet.
 *
 * Run: npx tsx scripts/profile-css-attacks.ts
 */
import { sanitizeProfileCss } from "../src/lib/profileCss";

const SCOPE = ".profile-skin";
const attacks: [string, string, (out: string) => boolean][] = [
  ["escapes the style tag", "b{color:red}</style><script>alert(1)</script>",
   (o) => !o.includes("<") && !o.toLowerCase().includes("script>")],
  ["styles the whole document", ":root{background:red}",
   (o) => o.startsWith(".profile-skin{")],
  ["styles the nav bar", ".apple-nav{display:none}",
   (o) => o.includes(".profile-skin .apple-nav") && !/^\.apple-nav/m.test(o)],
  ["fake full-screen overlay", ".x{position:fixed;inset:0;background:#fff}",
   (o) => !/position\s*:\s*fixed/i.test(o)],
  ["remote stylesheet", '@import url("https://evil.test/x.css"); b{color:red}',
   (o) => !o.includes("@import") && !o.includes("evil.test")],
  ["javascript url", "b{background:url(javascript:alert(1))}",
   (o) => !/javascript\s*:/i.test(o)],
  ["ie expression", "b{width:expression(alert(1))}",
   (o) => !/expression\s*\(/i.test(o)],
  ["moz binding", "b{-moz-binding:url(evil.xml#x)}",
   (o) => !/-moz-binding/i.test(o)],
  ["hides payload in a comment", "b{color:red} /* </style> */ i{color:blue}",
   (o) => !o.includes("<")],
  ["scopes inside media query", "@media (max-width:600px){ body{color:red} }",
   (o) => o.includes("@media") && o.includes(".profile-skin{color:red}")],
  ["keyframes left alone", "@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}",
   (o) => o.includes("@keyframes spin") && !o.includes(".profile-skin from")],
  ["body selector becomes the profile", "body{background:pink}",
   (o) => o.includes(".profile-skin{background:pink}")],
  ["multiple selectors all scoped", "h1, .card, a:hover{color:red}",
   (o) => (o.match(/\.profile-skin /g) ?? []).length === 3],
  ["background image still allowed", ".x{background:url(https://i.imgur.com/a.gif)}",
   (o) => o.includes("imgur.com")],
  ["broken css does not throw", "b{color:red",
   (o) => typeof o === "string"],
  ["length is capped", "a{}".repeat(9000),
   (o) => o.length < 200000],
];

let failed = 0;
for (const [name, input, check] of attacks) {
  const out = sanitizeProfileCss(input, SCOPE);
  const ok = check(out);
  if (!ok) failed++;
  console.log(`${ok ? "pass" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got: ${JSON.stringify(out).slice(0, 160)}`);
}
console.log(failed === 0 ? "\nAll attacks blocked." : `\n${failed} FAILED`);
