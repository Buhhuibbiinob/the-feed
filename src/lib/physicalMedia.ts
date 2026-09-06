// What a record from a given year would actually have been.
//
// The crate and the shelves are drawn as physical objects, so the object
// has to be the right one. A 1974 album on a CD spine is the same kind of
// wrong as a 2015 single on a cassette: it reads as decoration rather
// than as a thing somebody owned.
//
// The dates are the formats' commercial lives, not their invention. The
// CD existed in 1982 and almost nobody had one until about 1988; vinyl
// never stopped, but between roughly 1991 and 2007 a new release was a
// CD and everyone knew it.

export type MediaFormat = "vinyl" | "cassette" | "cd" | "download";

export const FORMAT_LABELS: Record<MediaFormat, string> = {
  vinyl: "Vinyl",
  cassette: "Cassette",
  cd: "CD",
  download: "Digital",
};

/**
 * The format a release from this year would have been sold on.
 *
 * One answer per year rather than a mix, because a shelf full of every
 * format at once says nothing about the era it is meant to evoke.
 */
export function formatForYear(year: number | null | undefined): MediaFormat {
  if (!year || !Number.isFinite(year)) return "vinyl";
  if (year < 1979) return "vinyl";
  // The cassette's decade. It overtook vinyl in 1983 and was still the
  // format most singles were bought on until the CD single arrived.
  if (year < 1991) return "cassette";
  if (year < 2008) return "cd";
  return "download";
}

/** The same, from a decade tag such as "90s" or "00s". */
export function formatForDecadeTag(tag: string): MediaFormat {
  const year = decadeStartYear(tag);
  // Mid decade rather than its first year: "the 80s" is 1985, not the
  // eleven months of 1980 that still sounded like 1979.
  return formatForYear(year === null ? null : year + 5);
}

/**
 * The decade tag a year belongs to: 1978 is "70s", 2005 is "00s".
 *
 * Worth a function rather than a slice at the call site, which is how it
 * was written first: `"1978".slice(2)` is "78", and "78s" then parses
 * back as the year 1978, so a shelf of 1978 records was being drawn as
 * cassettes. Zero padding is the other half of it, since 2005's decade
 * is "00s" and `2000 % 100` is the number 0.
 */
export function decadeTagForYear(year: number | null | undefined): string | null {
  if (!year || !Number.isFinite(year)) return null;
  const start = Math.floor(year / 10) * 10;
  return `${String(start % 100).padStart(2, "0")}s`;
}

export function decadeStartYear(tag: string): number | null {
  const m = tag.match(/^(\d{2})s$/);
  if (!m) return null;
  const two = Number(m[1]);
  // "00s" and "10s" are this century; everything else is the last one.
  return two <= 20 ? 2000 + two : 1900 + two;
}

/**
 * A format for something with no year at all.
 *
 * Deterministic rather than random: the same record must not be a CD on
 * one render and a cassette on the next, or the crate flickers as you
 * flip through it.
 */
export function formatForKey(key: string): MediaFormat {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const order: MediaFormat[] = ["vinyl", "cd", "cassette", "vinyl", "cd"];
  return order[Math.abs(hash) % order.length];
}
