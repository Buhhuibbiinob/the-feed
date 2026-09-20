// The subgenres LastThread sorts by, in one place so the analyser and the
// page agree. The page's own copy, with the descriptions, is the SUBGENRES
// list at the top of public/lastthread/app.js; these ids must match it.
export const SUBGENRE_IDS = [
  "archive",
  "minimal",
  "workwear",
  "tailoring",
  "punk",
  "y2k",
  "denim",
  "ivy",
  "gorp",
  "afromodern",
  "avant",
  "street",
] as const;

export type SubgenreId = (typeof SUBGENRE_IDS)[number];
