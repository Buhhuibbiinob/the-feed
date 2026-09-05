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
check("no banner without artwork", !hero.some((i) => i.id === "h"));

// ---- the shelves ----
const shelf1 = recentShelf(many);
check("first shelf is newest first", shelf1.map((i) => i.id).join(",") === "b,c,d,e");
check("a coverless post never reaches a shelf", !shelf1.some((i) => i.id === "h"));

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

// ---- the threshold ----
check("a profile with four covered reviews gets a store", hasStorefront(many));
check("a profile with two does not", !hasStorefront([post("1"), post("2")]));
check(
  "covers are what counts, not post count",
  !hasStorefront(Array.from({ length: 9 }, (_, i) => post(`n${i}`, { cover_url: null })))
);
check("an empty profile does not crash", heroPicks([]).length === 0 && chartRows([]).length === 0);

if (failures > 0) {
  console.error(`\n${failures} check${failures === 1 ? "" : "s"} failed.`);
  process.exit(1);
}
console.log("\nEvery shelf fills: reviews by rule, favourites by choice.");
