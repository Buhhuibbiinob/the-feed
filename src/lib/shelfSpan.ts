/**
 * The years a shelf claims, and whether a record belongs on it.
 *
 * Its own file because both the server and the browser need it: the
 * shelf checks the rows it enriched up front, and the page checks the
 * rest as their lookups come back. shelves.ts cannot be imported from a
 * client component - it reaches Last.fm and reads the API key - so the
 * pure half lives here.
 */

export type ShelfSpan = { from: number; to: number };

/**
 * Whether a record belongs on a shelf that claims a span of years.
 *
 * Every axis on the Shelves page is a Last.fm user tag, and a tag is a
 * folksonomy, not a fact. People tag a record "90s" because it sounds
 * like the nineties, or "1994" because that is the year they first heard
 * it, or because the reissue they own is dated that way. So a shelf
 * headed 1994 has always been able to hold a 2013 record, and did, which
 * is the thing that got reported.
 *
 * Two rules, and the second is the important one.
 *
 * A record whose year we do not know STAYS. Unknown is not wrong. The
 * catalogue answers null for anything it has not got and for everything
 * at all while Apple is throttling, so a check that dropped unknowns
 * would empty a whole shelf the moment the lookups started failing and
 * report it as "nothing was made that year" - the same silent failure
 * that once put artwork on two records out of twenty four.
 *
 * And the window is slack by a year at each end. A record released in
 * December 1989 is a 1990 record to everybody who bought it, and single
 * versus album dates disagree by months as a matter of course. Being
 * strict there would throw out records that genuinely belong.
 */
export function belongsOnShelf(
  year: number | null | undefined,
  span: ShelfSpan | null
): boolean {
  if (!span) return true;
  if (year === null || year === undefined) return true;
  return year >= span.from - 1 && year <= span.to + 1;
}
