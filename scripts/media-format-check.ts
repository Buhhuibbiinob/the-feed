/**
 * The right object for the year.
 *
 * A 1974 album drawn on a CD spine is the same kind of wrong as a 2015
 * single on a cassette: it stops reading as something somebody owned and
 * starts reading as decoration.
 *
 * Run: npx tsx scripts/media-format-check.ts
 */
import {
  decadeStartYear,
  formatForDecadeTag,
  formatForKey,
  formatForYear,
} from "../src/lib/physicalMedia";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

check("1967 is vinyl", formatForYear(1967) === "vinyl");
check("1974 is vinyl", formatForYear(1974) === "vinyl");
check("1985 is a cassette", formatForYear(1985) === "cassette", formatForYear(1985));
check("1994 is a CD", formatForYear(1994) === "cd");
check("2004 is a CD", formatForYear(2004) === "cd");
check("2015 is a download", formatForYear(2015) === "download");
check("no year at all still gets an object", formatForYear(null) === "vinyl");
check("nonsense does not crash it", formatForYear(NaN) === "vinyl");

check("the 70s shelf is vinyl", formatForDecadeTag("70s") === "vinyl");
check("the 80s shelf is cassettes", formatForDecadeTag("80s") === "cassette", formatForDecadeTag("80s"));
check("the 90s shelf is CDs", formatForDecadeTag("90s") === "cd");
check("the 2000s shelf is CDs", formatForDecadeTag("00s") === "cd", formatForDecadeTag("00s"));
check("the 2010s shelf is downloads", formatForDecadeTag("10s") === "download");
// Read from the middle, not the last year. 1979 is already into the
// cassette's decade, so a "70s" shelf read from its final year would be
// cassettes, which is not what anybody pictures.
check(
  "the 70s shelf is not read from 1979",
  formatForDecadeTag("70s") === "vinyl" && formatForYear(1979) === "cassette",
  `70s shelf is ${formatForDecadeTag("70s")}, 1979 alone is ${formatForYear(1979)}`
);

check("00s is this century", decadeStartYear("00s") === 2000);
check("90s is the last one", decadeStartYear("90s") === 1990);
check("something that is not a decade returns nothing", decadeStartYear("shoegaze") === null);

check(
  "the same record is always the same object",
  formatForKey("timeless|goldie") === formatForKey("timeless|goldie"),
  "otherwise the crate flickers between formats as you flip"
);
check(
  "different records are not all the same object",
  new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map(formatForKey)).size > 1
);

console.log(failures === 0 ? "\nThe right object for the year." : `\n${failures} failing.`);
process.exit(failures === 0 ? 0 : 1);
