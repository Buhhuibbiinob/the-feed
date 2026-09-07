/**
 * What ends up on each shelf of the store.
 *
 * The layout is wide and a member's catalogue is small, so the danger is
 * not that a shelf breaks - it is that all three shelves quietly show the
 * same four albums and the page looks broken in a way no error reports.
 * These pin the picking rules against a fixed set of posts.
 *
 * Run: npx tsx scripts/store-check.ts
 */
import {
  chartRows,
  featuredArtists,
  genresPresent,
  hasStorefront,
  heroPicks,
  recentShelf,
  favoritesShelf,
  popularShelf,
  type FavoriteLike,
  type StorePost,
} from "../src/lib/profileStore";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

const day = (n: number) => new Date(2026, 0, n).toISOString();
function post(id: string, over: Partial<StorePost> = {}): StorePost {
  return {
    id,
    title: `Album ${id}`,
    artist: `Artist ${id}`,
    cover_url: `/c/${id}.jpg`,
    rating: 3,
    created_at: day(1),
    genre: "rap",
    ...over,
  };
}

const many: StorePost[] = [
  post("a", { rating: 5, created_at: day(1) }),
  post("b", { rating: 5, created_at: day(9) }),
  post("c", { rating: 4, created_at: day(8) }),
  post("d", { rating: 4, created_at: day(7) }),
  post("e", { rating: 3, created_at: day(6) }),
  post("f", { rating: 2, created_at: day(5) }),
  post("g", { rating: 1, created_at: day(4) }),
  post("h", { rating: 5, created_at: day(3), cover_url: null }),
];

// ---- the banners ----
const hero = heroPicks(many);
check("three banners", hero.length === 3, hero.map((i) => i.id).join(","));
check("best rated leads, newest breaks the tie", hero[0].id === "b" && hero[1].id === "a");
// h is rated 5 and would be second on rating alone. Artwork is the
// first sort key now, so it loses to seven covered records - but on a
// profile where NOTHING has artwork it would lead, rather than the row
// coming back empty. Preference, not exclusion.
check("artwork wins the banner row while there is any", !hero.some((i) => i.id === "h"));

// ---- the shelves ----
const shelf1 = recentShelf(many);
check("first shelf is newest first", shelf1.map((i) => i.id).join(",") === "b,c,d,e");
// This shelf is "lately", so it does not reorder around cover art at
// all: h is simply the fifth newest. A shelf that sorted covered records
// forward would be reporting something other than what happened lately.
check("the recent shelf is recency only", !shelf1.some((i) => i.id === "h"));
check(
  "and it takes a coverless record when that is what is recent",
  recentShelf([post("bare", { cover_url: null, created_at: day(30) }), ...many])[0].id === "bare"
);

// ---- the second shelf: their own picks ----
// This used to be more reviews chosen by a rule, and the test here was
// that it must not repeat the shelf above. It is the member's own
// favourites now, so the rule that matters is different: what they
// picked is what shows, in the order they put it in.
const favs: FavoriteLike[] = [
  { id: "f1", title: "Aaliyah", subtitle: "artist", imageUrl: "/a.jpg" },
  { id: "f2", title: "In the Mood for Love", subtitle: "movie", imageUrl: null },
  { id: "f3", title: "Twin Peaks", subtitle: null, imageUrl: "/t.jpg" },
];
const shelf2 = favoritesShelf(favs);
check("the favourites shelf keeps their order", shelf2.map((i) => i.id).join(",") === "f1,f2,f3");
// Deliberately unlike the first shelf, which drops coverless reviews:
// somebody typed this one in on purpose.
check(
  "a favourite with no artwork still shows",
  shelf2.some((i) => i.id === "f2"),
  "dropping it would be the shelf overruling the person"
);
check("a missing subtitle becomes empty, not 'null'", shelf2[2].subtitle === "");
check("an empty shortlist is an empty shelf", favoritesShelf([]).length === 0);
check(
  "the shelf is capped",
  favoritesShelf(
    Array.from({ length: 40 }, (_, i) => ({
      id: `x${i}`,
      title: `T${i}`,
      subtitle: null,
      imageUrl: null,
    }))
  ).length <= 8
);

// ---- the bottom row: what other people reacted to ----
// The one slot on the page that reports somebody else's opinion. Every
// other shelf is the owner's own doing, so getting this one wrong makes
// the whole page a monologue.
const likes = new Map([["a", 1], ["b", 0], ["c", 9], ["d", 2]]);
const comments = new Map([["a", 4], ["b", 0], ["c", 0], ["d", 0]]);
const popular = popularShelf(many, likes, comments);
check("three tiles", popular.length === 3, popular.map((i) => i.id).join(","));
// a: 1 like + 4 comments = 9. c: 9 likes + 0 = 9. Tie, and a is older,
// so c wins on recency - which is the tie-break working, not luck.
check(
  "comments count double",
  popular.slice(0, 2).map((i) => i.id).sort().join(",") === "a,c",
  "a is 1 like + 4 comments; c is 9 likes; both score 9"
);
check(
  "popularity beats recency",
  popular[0].id !== "b",
  "b is the newest with artwork and has no likes or comments"
);
check(
  "no engagement at all still fills the row",
  popularShelf(many, new Map(), new Map()).length === 3,
  "ties break on recency, so it shows the newest three rather than nothing"
);
// The promo row reports what everybody ELSE thought, so popularity is
// the first key and artwork only breaks ties. The old rule dropped
// coverless reviews outright, which meant the most talked about review
// on a profile could be missing from the one row that is about being
// talked about.
check(
  "the most popular review makes the row even with no artwork",
  popularShelf(many, new Map([["h", 99]]), new Map())[0].id === "h"
);
check(
  "artwork breaks a tie on the promo row",
  popularShelf(
    [post("bare", { cover_url: null, created_at: day(9) }), post("art", { created_at: day(9) })],
    new Map(),
    new Map()
  )[0].id === "art"
);

// ---- the chart ----
const chart = chartRows(many);
// b, h and a are all rated 5; newest breaks the tie, so h (day 3) sits
// above a (day 1) even though it has no artwork. That is correct - and
// it is the reason the next check exists.
check("chart is highest rated first, newest breaking ties", chart[0].id === "b" && chart[1].id === "h");
check(
  "the chart DOES take coverless posts",
  chart.some((i) => i.id === "h"),
  "it is a text list in the reference"
);
check("chart stops at ten", chartRows(Array.from({ length: 30 }, (_, i) => post(`x${i}`))).length === 10);

// ---- the sidebar ----
const artists = featuredArtists([
  post("1", { artist: "Nas" }),
  post("2", { artist: "Nas" }),
  post("3", { artist: "MF DOOM" }),
  post("4", { artist: "  " }),
  post("5", { artist: null }),
]);
check("featured artists are ranked by count", artists[0] === "Nas");
check("blank and missing artists are dropped", artists.length === 2, artists.join(", "));

check(
  "the genre menu only lists genres actually used",
  genresPresent([post("1", { genre: "rock" }), post("2", { genre: "rap" }), post("3", { genre: null })]).join(",") ===
    "rap,rock"
);

// ---- everyone gets a store ----
//
// There used to be a threshold here: four reviews with cover art, and
// below it a profile fell back to a stack of plain boxes. That made two
// different websites and showed the emptier one to exactly the people
// who had just arrived. These checks pin the replacement, which is that
// the store handles thin profiles rather than declining to appear.
check("a full profile gets a store", hasStorefront(many));
check("a profile with one review gets one too", hasStorefront([post("1")]));
check(
  "so does a profile whose reviews have no artwork at all",
  hasStorefront(Array.from({ length: 9 }, (_, i) => post(`n${i}`, { cover_url: null })))
);
check(
  "a shelf of coverless reviews is not an empty shelf",
  recentShelf(Array.from({ length: 4 }, (_, i) => post(`n${i}`, { cover_url: null }))).length === 4,
  "they draw as lettered blank sleeves rather than vanishing"
);
check(
  "a banner row of coverless reviews is not empty either",
  heroPicks([post("n1", { cover_url: null })]).length === 1
);
check(
  "artwork still leads the banner row when there is any",
  heroPicks([post("bare", { cover_url: null, rating: 5 }), post("art", { rating: 4 })])[0].id === "art",
  "a banner is mostly a picture, so a covered four beats a bare five"
);
check("an empty profile does not crash", heroPicks([]).length === 0 && chartRows([]).length === 0);

if (failures > 0) {
  console.error(`\n${failures} check${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
console.log("\nEvery shelf fills: reviews by rule, favourites by choice.");
