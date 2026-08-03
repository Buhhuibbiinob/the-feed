// The site's canonical public URL. Vercel also serves every deployment on a
// *.vercel.app domain, and if NEXT_PUBLIC_SITE_URL is pointed at one of
// those it leaks into places it really shouldn't: sign-in and password
// reset emails, the sitemap, robots.txt, and OpenGraph tags. Those deploy
// URLs change per deployment and aren't the brand, so they're ignored here
// in favour of the real domain.
const CANONICAL_URL = "https://mythefeed.com";

function isVercelDeployUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (configured && !isVercelDeployUrl(configured)) return configured;
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  return CANONICAL_URL;
}
