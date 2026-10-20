/**
 * The record store's catalogue matching: every DVD shows its own poster
 * and every album its own sleeve.
 *
 * The catalogue is filled from Apple's search, which is a relevance
 * search - ask for "Heat" and it will happily hand back several films
 * called Heat. These pin the rules that decide which answer is the film
 * that was asked for, and that refuse when it cannot be told.
 *
 * Run: npx tsx scripts/store-catalogue-check.ts
 */
import {
  cleanAlbumTitle,
  filmItem,
  largerArtwork,
  matchFilm,
  pickAlbums,
  storeFormatFor,
  type ItunesMovieRow,
  type ItunesSongRow,
} from "../src/lib/storeCatalogue";
import { FILM_SEEDS } from "../src/lib/storeSeeds";
import { normalizeName } from "../src/lib/works";
import { SECTIONS, isAllowedArtHost, nextUtcMidnight, storeErrorMessage } from "../src/lib/store";
import { decideAccess, parseLaunchAt } from "../src/lib/storeAccess";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

const film = (id: number, name: string, date: string, over: Partial<ItunesMovieRow> = {}): ItunesMovieRow => ({
  wrapperType: "track",
  kind: "feature-movie",
  trackId: id,
  trackName: name,
  artistName: "Director",
  artworkUrl100: `https://is1-ssl.mzstatic.com/image/thumb/${id}/100x100bb.jpg`,
  releaseDate: `${date}T07:00:00Z`,
  ...over,
});

// ---------- films ----------
const heats = [
  film(1, "Heat", "1986-03-14"),
  film(2, "Heat", "1995-12-15", { artistName: "Michael Mann" }),
  film(3, "The Heat", "2013-06-28"),
  film(4, "Heat Wave", "1995-01-01"),
];
check("Heat (1995) is Michael Mann's, not the 1986 one", matchFilm(heats, { title: "Heat", year: 1995 })?.trackId === 2);
check("Heat with no year is refused: two different films have that name", matchFilm(heats, { title: "Heat" }) === null);
check("'The Heat' is not 'Heat'", matchFilm([film(3, "The Heat", "2013-06-28")], { title: "Heat", year: 2013 }) === null);
check("a film from the wrong year is not a match", matchFilm(heats, { title: "Heat", year: 2004 }) === null);
check(
  "a release date a year off (another country's) still matches",
  matchFilm([film(9, "Amélie", "2002-02-08")], { title: "Amélie", year: 2001 })?.trackId === 9
);
check(
  "accents and punctuation do not stop a match",
  matchFilm([film(10, "Amelie", "2001-04-25")], { title: "Amélie", year: 2001 })?.trackId === 10
);
check(
  "Apple's 'Title (1995)' naming is the same film",
  matchFilm([film(11, "Heat (1995)", "1995-12-15")], { title: "Heat", year: 1995 })?.trackId === 11
);
check(
  "two different films with one name a year apart are refused",
  matchFilm([film(12, "Twin", "2000-01-01"), film(13, "Twin", "2001-01-01")], { title: "Twin", year: 2000 }) === null
);
check(
  "a sequel is not the original",
  matchFilm([film(14, "Dune: Part Two", "2024-03-01")], { title: "Dune", year: 2024 }) === null
);
check(
  "a remake is not the original",
  matchFilm([film(15, "Dune", "1984-12-14"), film(16, "Dune", "2021-10-22")], { title: "Dune", year: 2021 })?.trackId === 16
);
check(
  "a TV episode or a song with the name is not the film",
  matchFilm(
    [{ ...film(17, "Heat", "1995-12-15"), kind: "tv-episode" }, { ...film(18, "Heat", "1995-12-15"), kind: "song" }],
    { title: "Heat", year: 1995 }
  ) === null
);
check(
  "a record with no artwork is never stocked",
  matchFilm([film(19, "Heat", "1995-12-15", { artworkUrl100: undefined })], { title: "Heat", year: 1995 }) === null
);
check(
  "a reviewed film with no year is stocked only when there is one film of that name",
  matchFilm([film(20, "Moonlight", "2016-10-21"), film(20, "Moonlight", "2016-10-21")], { title: "Moonlight" })?.trackId === 20
);
const item = filmItem(film(2, "Heat (1995)", "1995-12-15", { previewUrl: "https://video.test/heat.m4v", shortDescription: "Cops and robbers." }));
check("the DVD's title, poster and trailer all come from one record", item.title === "Heat" && item.artwork_url.includes("/2/") && item.preview_label === "Trailer");
check("the poster is asked for at a usable size", item.artwork_url.endsWith("/600x600bb.jpg"), item.artwork_url);
check("a DVD is a movie_tv item on the dvd shelf", item.media_type === "movie_tv" && item.format === "dvd");
check("a film's work key is the one the rest of the site uses", item.work_key === "movie_tv:heat");

const seen = new Set<string>();
const dupes = FILM_SEEDS.filter((f) => {
  const k = `${normalizeName(f.title)}:${f.year}`;
  if (seen.has(k)) return true;
  seen.add(k);
  return false;
});
check("no film is seeded twice", dupes.length === 0, dupes.map((d) => d.title).join(", "));
check("every film seed has a plausible year", FILM_SEEDS.every((f) => f.year >= 1900 && f.year <= 2030));

// ---------- albums ----------
const song = (album: number, collection: string, artist: string, date: string, over: Partial<ItunesSongRow> = {}): ItunesSongRow => ({
  wrapperType: "track",
  kind: "song",
  trackName: `Song from ${collection}`,
  artistName: artist,
  collectionId: album,
  collectionName: collection,
  artworkUrl100: `https://is1-ssl.mzstatic.com/image/thumb/${album}/100x100bb.jpg`,
  previewUrl: `https://audio.test/${album}.m4a`,
  releaseDate: `${date}T07:00:00Z`,
  primaryGenreName: "R&B/Soul",
  ...over,
});
const prince = [
  song(1, "Purple Rain", "Prince", "1984-06-25"),
  song(1, "Purple Rain", "Prince", "1984-06-25"),
  song(1, "Purple Rain", "Prince", "1984-06-25"),
  song(2, "Sign o' the Times", "Prince", "1987-03-30"),
  song(2, "Sign o' the Times", "Prince", "1987-03-30"),
  song(3, "Kiss - Single", "Prince", "1986-02-05"),
  song(3, "Kiss - Single", "Prince", "1986-02-05"),
  song(3, "Kiss - Single", "Prince", "1986-02-05"),
  song(3, "Kiss - Single", "Prince", "1986-02-05"),
  song(4, "Phase II", "Prince Royce", "2012-04-24"),
  song(4, "Phase II", "Prince Royce", "2012-04-24"),
  song(4, "Phase II", "Prince Royce", "2012-04-24"),
  song(4, "Phase II", "Prince Royce", "2012-04-24"),
];
const albums = pickAlbums(prince, "Prince");
check("Prince's two albums, most played first", albums.map((a) => a.title).join("|") === "Purple Rain|Sign o' the Times", albums.map((a) => a.title).join("|"));
check("Prince Royce is not Prince", !albums.some((a) => a.artist === "Prince Royce"));
check("singles are not albums", !albums.some((a) => a.title.includes("Single")));
check("each album's sleeve is its own", albums[0].artwork_url.includes("/1/") && albums[1].artwork_url.includes("/2/"));
check("the clip is a song off that album", albums[0].preview_url === "https://audio.test/1.m4a");
check("an album's work key is the one the rest of the site uses", albums[0].work_key === "music:prince:purple rain");

const rumours = pickAlbums(
  [
    song(5, "Rumours (Super Deluxe)", "Fleetwood Mac", "2013-01-28"),
    song(5, "Rumours (Super Deluxe)", "Fleetwood Mac", "2013-01-28"),
    song(6, "Rumours", "Fleetwood Mac", "1977-02-04"),
  ],
  "Fleetwood Mac"
);
check("a deluxe reissue and the original are one album", rumours.length === 1 && rumours[0].title === "Rumours");
check("its year is the original's, not the reissue's", rumours[0].year === 1977);
check("and it is on vinyl, where a 1977 record belongs", rumours[0].format === "vinyl");
check("the plain edition's sleeve is used when there is one", rumours[0].artwork_url.includes("/6/"));
check("an artist with nothing in the results gets nothing", pickAlbums(prince, "Sade").length === 0);

check("edition noise comes off album titles", cleanAlbumTitle("Thriller (25th Anniversary Edition)") === "Thriller");
check("so does a remaster tag in square brackets", cleanAlbumTitle("Abbey Road [Remastered]") === "Abbey Road");
check("a bracket that is part of the name stays", cleanAlbumTitle("(What's the Story) Morning Glory?") === "(What's the Story) Morning Glory?");
check("Apple's thumbnail is swapped for a bigger one", largerArtwork("https://a.mzstatic.com/x/100x100bb.jpg") === "https://a.mzstatic.com/x/600x600bb.jpg");

// ---------- formats ----------
check("a 1972 record is vinyl", storeFormatFor(1972, "k") === "vinyl");
check("a 1985 record is a cassette", storeFormatFor(1985, "k") === "cassette");
check("a 2004 record is a CD", storeFormatFor(2004, "k") === "cd");
check("a 1995 record is a CD or a cassette, never vinyl", ["cd", "cassette"].includes(storeFormatFor(1995, "k")));
check("a 2016 record is vinyl or CD, never a cassette", ["cd", "vinyl"].includes(storeFormatFor(2016, "k")));
check("the same record always lands on the same shelf", storeFormatFor(1995, "music:a:b") === storeFormatFor(1995, "music:a:b"));

// ---------- the rest ----------
check("the art route only fetches from Apple's image CDN", isAllowedArtHost("is1-ssl.mzstatic.com") && !isAllowedArtHost("mzstatic.com.evil.test") && !isAllowedArtHost("evil.test"));
check("the database's refusals read as sentences", storeErrorMessage("ERROR: STORE_LIMIT").startsWith("That's your five"));
check("an unknown error does not leak its text", !storeErrorMessage("relation store_owned does not exist").includes("relation"));
check("the shelves restock at midnight UTC", nextUtcMidnight(new Date("2026-10-20T23:59:00Z")).toISOString() === "2026-10-21T00:00:00.000Z");
check("section caps add up to the forty slots the migration fills", SECTIONS.reduce((n, s) => n + s.cap, 0) === 40);

// ---------- who gets the store ----------
const at = new Date("2026-10-23T12:00:00Z");
const before = new Date("2026-10-23T11:59:59Z");
const after = new Date("2026-10-23T12:00:00Z");
check("an admin gets the store before any countdown", decideAccess(true, null, before).open);
check("an admin never sees the countdown", !decideAccess(true, at, before).counting);
check("before a countdown, members get the feed and no countdown", !decideAccess(false, null, before).open && !decideAccess(false, null, before).counting);
check("during the countdown, members see it and not the store", decideAccess(false, at, before).counting && !decideAccess(false, at, before).open);
check("at the launch second, it opens by itself", decideAccess(false, at, after).open && !decideAccess(false, at, after).counting);
check("a garbled launch time is no launch time", parseLaunchAt("soon") === null && !decideAccess(false, parseLaunchAt("soon"), after).open);
check("launch times are read as UTC", parseLaunchAt("2026-10-23T12:00:00.000Z")?.toISOString() === "2026-10-23T12:00:00.000Z");

if (failures > 0) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log("\nall passed");
