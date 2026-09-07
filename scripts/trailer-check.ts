/**
 * Discover's film rail, without a paid catalogue.
 *
 * Two things can go wrong here and both are quiet:
 *
 *   1. The quota. A YouTube search is 100 units of 10,000 a day. Adding
 *      one genre to the lane list adds five queries, and five queries is
 *      2,000 units a day at the current TTL. Nothing complains until the
 *      day the search boxes start returning 429 to everybody, which is
 *      exactly the failure that made this feature necessary.
 *   2. The parsing. YouTube titles are written by uploaders, not by a
 *      catalogue, and a parser that gives up quietly produces a rail of
 *      cards called "Official Trailer".
 */
import {
  LANES,
  REFRESHES_PER_DAY,
  UNITS_PER_SEARCH,
  DAILY_UNIT_BUDGET,
  DISCOVER_QUOTA_SHARE,
  TRAILER_TTL_SECONDS,
  worstCaseDailyUnits,
  filmTitleFromVideo,
  looksLikeAFilm,
  rankTrailers,
  pickLane,
  screenFinds,
} from "../src/lib/trailers";
import type { Known, SeedPost } from "../src/lib/musicDiscovery";
import { readFileSync } from "node:fs";

let failed = 0;
const ok = (m: string) => console.log(`ok    ${m}`);
const bad = (m: string) => {
  failed++;
  console.log(`FAIL  ${m}`);
};
function eq(actual: unknown, expected: unknown, what: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) ok(`${what}`);
  else bad(`${what} - got ${JSON.stringify(actual)}, wanted ${JSON.stringify(expected)}`);
}

// ---- The quota, done as arithmetic rather than as a hope ----
const worst = worstCaseDailyUnits();
const allowed = DAILY_UNIT_BUDGET * DISCOVER_QUOTA_SHARE;
if (worst <= allowed) {
  ok(
    `the whole rail costs at most ${worst} units a day - ${LANES.length} lanes x ${REFRESHES_PER_DAY} refreshes x ${UNITS_PER_SEARCH}, inside the ${allowed} it may spend`
  );
} else {
  bad(
    `the rail would cost ${worst} units a day against a ${allowed} allowance. ${LANES.length} lanes at a ${TRAILER_TTL_SECONDS / 3600}h TTL is too many: either drop lanes or hold answers longer. Overspending here takes the search boxes down with it.`
  );
}

// The cost has to be independent of how many people visit. If a lane's
// query ever contains something a person supplied, this stops being true
// and every visitor is their own cache miss.
const templated = LANES.filter((l) => /\{|\$\{|undefined|null/.test(l.query));
if (templated.length === 0) {
  ok("every lane's query is a fixed string, so visitors share one cached answer rather than each paying for their own");
} else {
  bad(`${templated.length} lane(s) have an unresolved query: ${templated.map((l) => l.query).join(", ")}`);
}
const unique = new Set(LANES.map((l) => l.query));
eq(unique.size, LANES.length, "no two lanes send the same query, which would be a lane that can never be reached");

// ---- Parsing real upload titles ----
const CASES: [string, string, string | null][] = [
  ["THE THING (1982) - Original Theatrical Trailer", "The Thing", "1982"],
  ["Alien | Official Trailer | 20th Century FOX", "Alien", null],
  ["Heat - Official Trailer [HD]", "Heat", null],
  ["Blade Runner (1982) Official Trailer - Harrison Ford", "Blade Runner", "1982"],
  ["PARASITE - Official Trailer", "Parasite", null],
  ["Night of the Living Dead 1968 trailer", "Night of the Living Dead", "1968"],
  ["The Silence of the Lambs — Trailer HD", "The Silence of the Lambs", null],
  // An uploader numbering their own uploads. The hash and its number
  // used to survive and end up as part of the name: "The Fifth Element 1".
  ["The Fifth Element (1997) Official Trailer #1 - Bruce Willis Movie HD", "The Fifth Element", "1997"],
  // "trailer hd" is stripped as one phrase, which used to leave
  // "original" qualifying nothing: "The Game Original".
  ["The Game (1997) Original Trailer HD", "The Game", "1997"],
  // And the reason that is fixed with a phrase rather than a word. Strip
  // a bare "original" and this becomes a different film.
  ["The Original Kings of Comedy (2000) Trailer", "The Original Kings of Comedy", "2000"],
  ["Original Sin (2001) Trailer", "Original Sin", "2001"],
];
for (const [input, title, year] of CASES) {
  const got = filmTitleFromVideo(input);
  if (got.title === title && got.year === year) {
    ok(`"${input.slice(0, 42)}..." reads as ${title}${year ? ` (${year})` : ""}`);
  } else {
    bad(`"${input}" read as ${JSON.stringify(got)}, wanted ${title} / ${year}`);
  }
}

// Small words stay lowercase inside a title but not at either end.
eq(filmTitleFromVideo("NIGHT OF THE HUNTER - trailer").title, "Night of the Hunter", "shouted titles come back in normal case");

// ---- The rubbish that has to be thrown away ----
for (const junk of ["Top 10 Horror Movies", "Alien Explained", "1982", "", "Best of the 80s"]) {
  if (looksLikeAFilm(junk)) bad(`"${junk}" was accepted as a film`);
  else ok(`"${junk}" is not offered as a film`);
}

// ---- The rail's own two rules ----
const known: Known = { works: new Set(["the thing"]), artists: new Set() } as unknown as Known;
const videos = [
  { id: "a", title: "THE THING (1982) - Trailer", channelTitle: "Archive", thumbnailUrl: "t1" },
  { id: "b", title: "Alien | Official Trailer", channelTitle: "Fox", thumbnailUrl: "t2" },
  { id: "c", title: "ALIEN - Original Theatrical Trailer", channelTitle: "Other", thumbnailUrl: "t3" },
  { id: "d", title: "Top 10 Alien Moments", channelTitle: "List", thumbnailUrl: "t4" },
];
const ranked = rankTrailers(videos, known, "horror", 8);
eq(ranked.map((r) => r.title), ["Alien"], "a film already reviewed is dropped, the same trailer uploaded twice collapses to one, and a listicle never gets in");
eq(ranked[0]?.videoId, "b", "the card keeps the video id, so the trailer can play in the card rather than sending somebody to YouTube");

// ---- The lane somebody lands in ----
const horrorFan: SeedPost[] = [
  { media_type: "movie_tv", rating: 5, genre: "horror" } as SeedPost,
  { media_type: "movie_tv", rating: 5, genre: "horror" } as SeedPost,
];
const lanes = new Set([0, 1, 2, 3, 4].map((s) => pickLane(horrorFan, s).genre));
eq([...lanes], ["horror"], "somebody who rates horror highly stays in horror however the rotation falls");
const decades = new Set([0, 1, 2, 3, 4].map((s) => pickLane(horrorFan, s).decade));
if (decades.size > 1) ok(`the decade moves with the rotation - ${decades.size} of them across five spins, so the rail is not the same films forever`);
else bad("every spin returned the same decade, so a refresh shows the identical rail");

const newcomer = pickLane([], 3);
if (newcomer.genre === null) ok("somebody with no film reviews gets the wide lane rather than an empty rail");
else bad(`a newcomer landed in the ${newcomer.genre} lane, which is a guess dressed up as taste`);

// ---- No key, no crash ----
async function main() {
  const emptyKnown: Known = { works: new Set(), artists: new Set() } as unknown as Known;
  const result = await screenFinds([], emptyKnown, async () => {
    throw new Error("no API key");
  });
  eq(result.finds, [], "a failing search returns an empty rail rather than taking Discover down with it");

  // ---- And no TMDB on any page somebody browses films on ----
  //
  // This used to check Discover alone, and Discover was clean while the
  // home page, the page its See All linked to, and the Shelves film wall
  // all still went to a paid catalogue. "Films come from YouTube" is
  // either true of every page that shows films or it is not true.
  const src = [
    "src/lib/trailers.ts",
    "src/app/recs/page.tsx",
    "src/app/page.tsx",
    "src/app/new-releases/page.tsx",
    "src/app/shelves/page.tsx",
    "src/app/crate/page.tsx",
  ]
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");
  // Usage, not the word. A comment saying why Discover no longer needs a
  // paid catalogue is the note somebody will thank us for; an import or a
  // read of the key is the thing that costs money.
  const reaches = [
    /from\s+["'][^"']*tmdb["']/i,
    /TMDB_API_KEY/,
    /api\.themoviedb\.org/i,
  ].filter((re) => re.test(src));
  if (reaches.length > 0) {
    bad(`a film page still reaches for TMDB (${reaches.length} way(s)) - the point was that it costs money and should not be needed`);
  } else {
    ok("no page that shows films imports TMDB, reads its key or calls its endpoint, so there is nothing to pay for");
  }

  console.log(
    failed === 0
      ? "\nTrailers instead of a catalogue, and the quota adds up."
      : `\n${failed} problem(s).`
  );
  process.exit(failed === 0 ? 0 : 1);
}

void main();
