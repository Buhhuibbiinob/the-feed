// The Feed is closed while the site moves to a new idea.
//
// mythefeed.com/ is now the "temporarily closed" page (public/closed). The
// feed itself still works, as an archive: its home moved from / to
// /archive, which the proxy serves from the old home page so nothing about
// the feed itself had to move. Every link that used to mean "the feed" points
// here instead of at /.
export const FEED_HOME = "/archive";

// When the countdown on the closed page reaches zero. Keep it in step with
// REOPENS_AT in public/closed/index.html, which is a static page and cannot
// import this.
export const REOPENS_AT = "2027-01-14T17:00:00Z";

/** A link into the archive's feed, with its query built here rather than
 *  bolted onto FEED_HOME at the call site (see scripts/link-check.ts). */
export function feedUrl(params: Record<string, string> = {}, hash = ""): string {
  const qs = new URLSearchParams(params).toString();
  return `${FEED_HOME}${qs ? `?${qs}` : ""}${hash ? `#${hash}` : ""}`;
}
