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

/** The same, from a decade tag such as "90s", "00s" or "2010s". */
export function formatForDecadeTag(tag: string, now: Date = new Date()): MediaFormat {
  const year = decadeStartYear(tag, now);
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

/**
 * The first year of a decade tag: "90s" is 1990, "2010s" is 2010.
 *
 * Both spellings, because both are real. Last.fm's own tag for the
 * nineties is "90s" and its tag for the twenty tens is "2010s", and this
 * only accepted the two digit one - so "2010s" came back null, the shelf
 * asked for the format of no year at all, got the fallback, and drew a
 * decade of streaming era records as twelve inch vinyl. The Year wall
 * had it right the whole time, because 2015 goes through
 * decadeTagForYear and comes out "10s", which does parse. Two walls
 * disagreeing about the same ten years is the tell.
 *
 * Which century a two digit tag means is decided against today rather
 * than against a number typed in once: a decade that has already begun
 * is this century, and one that has not is the last. "20s" is the 2020s
 * now and "30s" is still the 1930s, and in 2035 that flips on its own
 * instead of quietly meaning the wrong hundred years.
 */
export function decadeStartYear(tag: string, now: Date = new Date()): number | null {
  const four = tag.match(/^([12]\d{3})s$/);
  if (four) return Number(four[1]);
  const m = tag.match(/^(\d{2})s$/);
  if (!m) return null;
  const two = Number(m[1]);
  return two <= now.getFullYear() % 100 ? 2000 + two : 1900 + two;
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

/**
 * The object for a record, using its year when the catalogue gave us one.
 *
 * formatForKey is a hash, which is the right answer for something whose
 * year nobody knows: stable, so the crate does not flicker between
 * formats as you flip through it, and varied, so a rack is not a rack of
 * one thing. It is the wrong answer the moment a real date turns up. A
 * 1968 soul record drawn as a jewel case is the same complaint as a
 * record on the wrong decade shelf - the object is the era, so a known
 * year outranks a hash of the title every time.
 */
export function formatFor(key: string, year: number | null | undefined): MediaFormat {
  return year ? formatForYear(year) : formatForKey(key);
}
