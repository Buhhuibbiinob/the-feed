/**
 * The rules that make a recommendation a discovery rather than a repeat.
 *
 * Every one of these is a way the row has already been seen to go wrong
 * in other recommenders: it hands back a record you reviewed last week,
 * or it hands back five songs by one artist, or it re-rolls itself while
 * you are reading it. None of that needs a network call to check.
 *
 * Run: npx tsx scripts/discovery-check.ts
 */
import {
  lovedGenres,
  alreadyKnown,
  dayIndex,
  NOTHING_KNOWN,
  rankFinds,
  rotate,
  seedArtists,
  type SeedPost,
} from "../src/lib/musicDiscovery";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

const track = (name: string, artist: string, becauseOf: string | null = null) => ({
  id: `${artist}-${name}`,
  name,
  artist,
  imageUrl: null,
  becauseOf,
});

// ---- seeds --------------------------------------------------------------

const posts: SeedPost[] = [
  { media_type: "music", title: "Boy Soft", artist: "2hollis", rating: 5 },
  { media_type: "music", title: "Frailty", artist: "Jane Remover", rating: 4 },
  { media_type: "music", title: "Something Fine", artist: "Filler", rating: 2 },
  { media_type: "film", title: "Fallen Angels", artist: "Wong Kar-wai", rating: 5 },
  { media_type: "music", title: "Boy Soft Again", artist: "2HOLLIS ", rating: 5 },
];

const seeds = seedArtists(posts);
check("only music seeds discovery", !seeds.includes("Wong Kar-wai"), seeds.join(", "));
check("a two-star review is not a seed", !seeds.includes("Filler"));
check("the same artist is not seeded twice", seeds.length === 2, seeds.join(", "));

const lukewarm: SeedPost[] = [{ media_type: "music", title: "A", artist: "Somebody", rating: 3 }];
check(
  "nothing rated highly still seeds from what they did review",
  seedArtists(lukewarm)[0] === "Somebody"
);
check("no music at all seeds nothing", seedArtists([]).length === 0);

// ---- what a find must not be -------------------------------------------

const known = alreadyKnown(posts);
const filtered = rankFinds(
  [
    track("boy soft", "2hollis", "2hollis"),
    track("Anything Else", "2hollis", "2hollis"),
    track("Census Designated", "Jane Remover", "Jane Remover"),
    track("Real Find", "Wisp", "2hollis"),
  ],
  known,
  10
);
check(
  "a record they already reviewed is not a discovery",
  !filtered.some((f) => f.name.toLowerCase() === "boy soft")
);
check(
  "an artist they already review is not a discovery either",
  !filtered.some((f) => f.artist === "2hollis" || f.artist === "Jane Remover"),
  filtered.map((f) => f.artist).join(", ")
);
check("what is left is the actual find", filtered.length === 1 && filtered[0].artist === "Wisp");

// The hyphen case, which is most of the names in music spelled two ways.
// Deleting punctuation instead of spacing it welded "Jay-Z" into "jayz"
// while "Jay Z" stayed "jay z", so a recommender happily handed back the
// record you reviewed last week under the other spelling.
const spellings = rankFinds(
  [track("99 Problems", "Jay Z", "seed")],
  alreadyKnown([{ media_type: "music", title: "99 Problems", artist: "Jay-Z", rating: 5 }]),
  5
);
check(
  "one artist spelled two ways is one artist",
  spellings.length === 0,
  "'Jay-Z' and 'Jay Z' must not be two different people"
);

const deduped = rankFinds(
  [track("Same Song", "Wisp", "a"), track("same  song ", "Wisp", "b")],
  NOTHING_KNOWN,
  10
);
check("the same song reached from two directions appears once", deduped.length === 1);

// ---- one artist cannot take the row ------------------------------------

const interleaved = rankFinds(
  [
    track("A1", "Alpha", "seed one"),
    track("A2", "Alpha", "seed one"),
    track("A3", "Alpha", "seed one"),
    track("A4", "Alpha", "seed one"),
    track("B1", "Beta", "seed two"),
    track("B2", "Beta", "seed two"),
  ],
  NOTHING_KNOWN,
  4
);
check(
  "the row alternates between seeds instead of stacking one",
  interleaved.map((f) => f.name).join(",") === "A1,B1,A2,B2",
  interleaved.map((f) => f.name).join(",")
);

const lopsided = rankFinds(
  [track("A1", "Alpha", "one"), track("A2", "Alpha", "one"), track("B1", "Beta", "two")],
  NOTHING_KNOWN,
  10
);
check(
  "a seed that ran out doesn't cut the row short",
  lopsided.length === 3,
  lopsided.map((f) => f.name).join(",")
);

check(
  "every find carries the seed that produced it",
  lopsided.every((f) => f.becauseOf !== null)
);
check(
  "a limit of zero returns nothing rather than looping",
  rankFinds([track("A", "Alpha", "one")], NOTHING_KNOWN, 0).length === 0
);
check(
  "a track with no artist is skipped, not shown as a blank card",
  rankFinds([track("A", "", "one")], NOTHING_KNOWN, 5).length === 0
);

// ---- holds still today, moves tomorrow ---------------------------------

const list = ["a", "b", "c", "d"];
const today = dayIndex(new Date("2026-09-06T09:00:00Z"));
const tonight = dayIndex(new Date("2026-09-06T23:00:00Z"));
const tomorrow = dayIndex(new Date("2026-09-07T09:00:00Z"));
check("the page does not re-roll while somebody is reading it", today === tonight);
check("it is different tomorrow", today !== tomorrow);
check(
  "rotating starts the list somewhere else",
  rotate(list, today).join("") !== rotate(list, tomorrow).join("")
);
check("rotating keeps everything", rotate(list, 99).slice().sort().join("") === "abcd");
check("rotating an empty list is not a crash", rotate([], 3).length === 0);


// ---- taste as a direction, not just a list of artists ------------------
//
// Artists say who somebody already listens to. Genre says which way they
// lean, which is the thing that survives when three artists run out.
const rated: SeedPost[] = [
  { media_type: "music", title: "a", artist: "A", rating: 5, genre: "shoegaze" },
  { media_type: "music", title: "b", artist: "B", rating: 4, genre: "shoegaze" },
  { media_type: "music", title: "c", artist: "C", rating: 5, genre: "house" },
  { media_type: "music", title: "d", artist: "D", rating: 2, genre: "metal" },
  { media_type: "film", title: "e", artist: "E", rating: 5, genre: "horror" },
];
check(
  "the style rated highest most often comes first",
  lovedGenres(rated)[0] === "shoegaze",
  lovedGenres(rated).join(", ")
);
check("a two-star review is not a direction", !lovedGenres(rated).includes("metal"));
check("a film genre is not a music direction", !lovedGenres(rated).includes("horror"));
check("nothing rated highly is no direction at all", lovedGenres([]).length === 0);
check(
  "a review with no genre does not break it",
  lovedGenres([{ media_type: "music", title: "x", artist: "X", rating: 5 }]).length === 0
);

// ---- names that are not artists ---------------------------------------
const vevo: SeedPost[] = [
  { media_type: "music", title: "No Scrubs", artist: "TLCVEVO", rating: 5 },
  { media_type: "music", title: "Judas", artist: "Lady Gaga - Topic", rating: 5 },
];
check(
  "a YouTube channel name is cleaned before it is used as a seed",
  seedArtists(vevo).join(", ") === "TLC, Lady Gaga",
  seedArtists(vevo).join(", ") + " - otherwise the card reads 'Because you liked TLCVEVO'"
);
check(
  "a cleaned name is what gets excluded too",
  alreadyKnown(vevo).artists.has("tlc"),
  "or the same artist comes back as a recommendation under the other spelling"
);

console.log(failures === 0 ? "\nDiscovery returns finds, not repeats." : `\n${failures} failing.`);
process.exit(failures === 0 ? 0 : 1);
