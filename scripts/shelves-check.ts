/**
 * The dividers, and what is behind them.
 *
 * The value in the URL goes straight into a Last.fm tag query, so the
 * guard on it is the one thing here that is not cosmetic. The rest is
 * about the page keeping its promise: a shelf is what the tag gave,
 * trimmed - not re-sorted into another ranking.
 *
 * Run: npx tsx scripts/shelves-check.ts
 */
import { readFileSync } from "node:fs";
import {
  FIRST_YEAR,
  SHELF_SIZE,
  axes,
  fillShelf,
  isAxis,
  isShelfValue,
  shelfTitle,
  shelfYears,
  yearValues,
  isMedium,
  filmPlaceTerm,
} from "../src/lib/shelves";
import { tagText, rosterFor, sameTag, SCENE_ROSTER, ROSTER_UNPLACED } from "../src/lib/lastfm";
import { isGenreFor } from "../src/lib/genres";
import { belongsOnShelf } from "../src/lib/shelfSpan";
import { NOTHING_KNOWN, alreadyKnown, type SeedPost } from "../src/lib/musicDiscovery";
import type { LastfmTrack } from "../src/lib/lastfm";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

const now = new Date("2026-09-06T12:00:00Z");
const track = (name: string, artist: string, listeners?: number): LastfmTrack => ({
  id: `${artist}-${name}`,
  name,
  artist,
  imageUrl: null,
  listeners,
});

// ---- the wall ----------------------------------------------------------

const wall = axes(now);
check("there are four ways in", wall.length === 4, wall.map((a) => a.id).join(", "));
check("every axis has dividers behind it", wall.every((a) => a.values.length > 0));
check(
  "every axis says what it gets you",
  wall.every((a) => a.prompt.length > 0 && a.label.length > 0)
);
check(
  "scenes are not only microgenres",
  ["soul", "disco", "house"].every((s) => wall.find((a) => a.id === "scene")!.values.includes(s)),
  "a wall that only holds microgenres is a wall for people who already know"
);

const years = yearValues(now);
check("the newest year comes first", years[0] === "2026", years.slice(0, 3).join(", "));
check("the wall reaches back to the start", years[years.length - 1] === String(FIRST_YEAR));
check("no year is missing", years.length === 2026 - FIRST_YEAR + 1, `${years.length} dividers`);

// ---- the guard on the URL ----------------------------------------------

check("a real axis is accepted", isAxis("scene") && isAxis("year"));
check("anything else is not", !isAxis("albums") && !isAxis("") && !isAxis(null));

check("a year on the wall is allowed", isShelfValue("year", "1994", now));
check("this year is allowed", isShelfValue("year", "2026", now));
check("next year is not", !isShelfValue("year", "2027", now), "there is nothing behind that divider yet");
check("a year before the wall starts is not", !isShelfValue("year", "1959", now));
check("a year that is not a year is not", !isShelfValue("year", "94", now) && !isShelfValue("year", "19x4", now));
check("a scene on the wall is allowed", isShelfValue("scene", "shoegaze", now));
check(
  "a tag somebody typed themselves is not",
  !isShelfValue("scene", "anything at all", now),
  "the value goes into a tag query, so it is checked rather than trusted"
);
check("an axis cannot borrow another's values", !isShelfValue("place", "shoegaze", now));
check("a non-string is not a value", !isShelfValue("scene", 7, now));

// ---- titles ------------------------------------------------------------

check("a year is its own title", shelfTitle("year", "1994") === "1994");
// A scene value is a SLUG, which is what the wall actually passes -
// this asked with a space in it, which no scene has ever had, and so
// tested a path the site never takes. Titled through genreLabel now, so
// the wall says UK R&B and PluggnB rather than Uk-Rnb and Pluggnb.
check("a scene is titled by its own label", shelfTitle("scene", "dream-pop") === "Dream Pop");
check("a scene the taxonomy spells oddly keeps its spelling", shelfTitle("scene", "uk-rnb") === "UK R&B", shelfTitle("scene", "uk-rnb"));
check("and one that title-cases wrong is overridden", shelfTitle("scene", "pluggnb") === "PluggnB", shelfTitle("scene", "pluggnb"));
check("a place is capitalised", shelfTitle("place", "new york") === "New York");
check("the 2000s is not 'The 00s'", shelfTitle("decade", "00s") === "The 2000s", shelfTitle("decade", "00s"));
check("a decade keeps its decade", shelfTitle("decade", "90s") === "The 90s");

// ---- the shelf ---------------------------------------------------------

// More than a shelf holds, plus the five the trim takes off the front.
// This was forty, from back when a shelf was twenty four, and nobody
// grew it when SHELF_SIZE became fifty: forty tracks cannot fill a fifty
// record shelf, so fillShelf took its short-chart fallback, kept the
// whole chart including the front five, and all three checks below went
// red - the cap, the trim and the order. They had been red ever since,
// unnoticed, because check:shelves was not in npm run lint. It is now.
const chart = Array.from({ length: SHELF_SIZE + 40 }, (_, i) => track(`t${i}`, `a${i}`));
const shelf = fillShelf(chart, NOTHING_KNOWN);
check("a shelf is capped", shelf.length === SHELF_SIZE, `${shelf.length} records`);
check(
  "the chart's front is trimmed",
  shelf[0].name === "t30",
  "the top thirty of a tag is the part that is on every playlist about it, and rank is the only popularity signal these charts carry - they report no listener counts, so trimming the front is the ONLY thing standing between a shelf and the famous ones"
);
check(
  "the order is the chart's, not a new one",
  shelf.slice(0, 4).map((s) => s.name).join(",") === "t30,t31,t32,t33",
  "re-sorting would be this page having an opinion"
);

const known = alreadyKnown([
  { media_type: "music", title: "t7", artist: "a7", rating: 3 },
] as SeedPost[]);
check(
  "a record you reviewed is off the shelf",
  !fillShelf(chart, known).some((s) => s.name === "t7")
);

const hits = [
  ...Array.from({ length: 5 }, (_, i) => track(`front${i}`, `f${i}`)),
  track("Everybody Knows This", "Famous", 3_000_000),
  track("Nobody Knows This", "Obscure", 900),
];
check(
  "a hit is not on the shelf",
  !fillShelf(hits, NOTHING_KNOWN).some((s) => s.name === "Everybody Knows This")
);
check(
  "a short chart falls back rather than emptying",
  fillShelf([track("Only One", "Someone")], NOTHING_KNOWN).length === 1,
  "trimming five off a four-track tag would leave a shelf with nothing on it"
);
check(
  "the same record twice appears once",
  fillShelf([track("Ceiling", "Wisp"), track("ceiling ", "Wisp")], NOTHING_KNOWN).length === 1
);
check(
  "a track with no artist is dropped",
  fillShelf([track("Orphan", "")], NOTHING_KNOWN).length === 0
);

// ---- it stays a browser, not a recommender -----------------------------

const src = readFileSync("src/lib/shelves.ts", "utf8");
for (const forbidden of ["seedArtists", "communitySeeds", "getSimilarArtists", "findsForSeeds"]) {
  check(`shelves do not call ${forbidden}`, !src.includes(forbidden));
}
check(
  "nothing is re-sorted",
  !/\.sort\(/.test(src),
  "the shelf is the tag chart trimmed; sorting it would be a ranking"
);

// ---- is it actually from that year? --------------------------------------
//
// Every axis here is a Last.fm user tag, and a tag is a folksonomy. People
// tag a record "90s" because it sounds like the nineties, "1994" because
// that is when they first heard it, or because the reissue they own is
// dated that way. The page printed the tag's word in the heading as
// though it were a fact, and the reason it can stop doing that is that
// the sleeve lookup comes back with a release year on it now.

check("a year shelf claims one year", JSON.stringify(shelfYears("year", "1994")) === '{"from":1994,"to":1994}');
check(
  "a decade shelf claims ten",
  JSON.stringify(shelfYears("decade", "90s")) === '{"from":1990,"to":1999}'
);
check(
  "the 2020s claims the right ten",
  JSON.stringify(shelfYears("decade", "2020s")) === '{"from":2020,"to":2029}'
);
check("a scene claims no years at all", shelfYears("scene", "shoegaze") === null);
check("nor does a place", shelfYears("place", "detroit") === null);

const nineties = shelfYears("decade", "90s");
check("a 1994 record is on the 90s shelf", belongsOnShelf(1994, nineties));
check("a 2013 record is not", !belongsOnShelf(2013, nineties));
check("nor is a 1974 one", !belongsOnShelf(1974, nineties));
check(
  "December 1989 counts as the 90s",
  belongsOnShelf(1989, nineties),
  "a record out that December was a 1990 record to everybody who bought it, and single and album dates disagree by months as a matter of course"
);
check("but 1988 does not", !belongsOnShelf(1988, nineties));

// The rule the whole thing turns on.
check(
  "a record whose year nobody knows stays on the shelf",
  belongsOnShelf(null, nineties) && belongsOnShelf(undefined, nineties),
  "unknown is not wrong - Apple answers null for everything while it is throttling, and dropping those would empty the shelf and call it 'nothing was made that year'"
);
check(
  "a shelf that claims no years keeps everything",
  belongsOnShelf(2013, null) && belongsOnShelf(null, null)
);

// ---- three walls, not one ------------------------------------------------
//
// The page was only ever music, and its axes were built for music. Film
// and photography want different ones: a place is a real thing to ask of
// a record and a tagging argument to ask of a film, and a year is a fact
// about a release and not about somebody's own photograph.

check("music is a medium", isMedium("music") && isMedium("film") && isMedium("photography"));
check("anything else is not", !isMedium("books") && !isMedium("") && !isMedium(7));

const filmWall = axes(now, "film").map((a) => a.id);
const photoWall = axes(now, "photography").map((a) => a.id);
const musicWall = axes(now, "music").map((a) => a.id);
check("music keeps the four it had", musicWall.join(",") === "scene,year,decade,place", musicWall.join(","));
check(
  "film is decade, kind and place",
  filmWall.join(",") === "decade,genre,place",
  filmWall.join(",")
);
check("photography is subject", photoWall.join(",") === "subject", photoWall.join(","));
check(
  "the default is still music, so every link written before this lands where it did",
  axes(now).map((a) => a.id).join(",") === musicWall.join(",")
);

// The guard is per medium now, because "decade" names two different
// walls and "subject" names one that only exists on the third.
check("a film decade is allowed on the film wall", isShelfValue("decade", "70s", now, "film"));
check(
  "the film wall carries the same decades as the music one",
  isShelfValue("decade", "2020s", now, "film") && isShelfValue("decade", "60s", now, "film"),
  "films have trailers in every one of them, so there is no reason to hold any back"
);
check("a film kind is allowed", isShelfValue("genre", "horror", now, "film"));
check("a made-up kind is not", !isShelfValue("genre", "mumblecore", now, "film"));
check("a subject is allowed on the photography wall", isShelfValue("subject", "street", now, "photography"));
check(
  "a subject is not a music axis",
  !isShelfValue("subject", "street", now, "music"),
  "the value goes into a query, so it is checked against the wall it is on"
);
check(
  "a scene cannot be borrowed onto the film wall",
  !isShelfValue("scene", "shoegaze", now, "film")
);

// A slug is what the database calls it; a divider card says the words.
check("a hyphenated subject is spelled out", shelfTitle("subject", "still-life") === "Still Life");
check(
  "and so is a long one",
  // "Black & White", not "Black And White". The taxonomy's own label,
  // which is how anybody writes it.
  shelfTitle("subject", "black-and-white") === "Black & White",
  shelfTitle("subject", "black-and-white")
);
// "Sci-Fi" keeps its hyphen, because that is the word. Title-casing the
// slug gave "Sci Fi", which is nothing.
check("a film kind is capitalised", shelfTitle("genre", "sci-fi") === "Sci-Fi", shelfTitle("genre", "sci-fi"));

// ---- Wider walls ------------------------------------------------------
//
// The Scene wall was thirty-six sounds chosen by hand and the Place wall
// was twenty-two cities, eleven of them in America or Britain. A wall
// called Place that is half two countries is a wall about the two scenes
// everybody already knows, which is most of why the same artists kept
// coming round.

const musicWall2 = axes(now, "music");
const scenes = musicWall2.find((a) => a.id === "scene")!.values;
const places = musicWall2.find((a) => a.id === "place")!.values;
check("the scene wall is the whole taxonomy", scenes.length > 300, `${scenes.length} scenes`);
check("the place wall spans the world", places.length > 100, `${places.length} places`);
check(
  "and it is no longer half Britain and America",
  places.filter((p) => ["lagos", "seoul", "sao paulo", "istanbul", "jakarta", "bamako"].includes(p))
    .length === 6,
  "the ones that were missing"
);

// A scene value is a genre slug and Last.fm files its tags with spaces.
// Asking for "uk-garage" comes back empty and reads as a thin corner of
// the catalogue rather than as the wrong question.
check("a hyphenated scene becomes tag text", tagText("uk-garage") === "uk garage");
check("and one with its own spelling is respected", tagText("drum-and-bass") === "drum and bass");
check("a plain one is left alone", tagText("shoegaze") === "shoegaze");

// Film places are searched by the word a search actually uses, which for
// most countries is not the country.
check("Nigeria's cinema is found as nollywood", filmPlaceTerm("nollywood") === "nollywood");
check("Korea's is found as korean", filmPlaceTerm("korean") === "korean");
check("Quebec's is found as quebecois", filmPlaceTerm("quebec") === "quebecois");
check("something that is not a film place has no term", filmPlaceTerm("detroit") === null);
check("a film place is titled by its label", shelfTitle("place", "nollywood") === "Nigeria");
check(
  "a music place keeps its own name",
  shelfTitle("place", "new york") === "New York",
  shelfTitle("place", "new york")
);


// ---- a shelf can never empty itself ----
//
// The swap-out in ShelfRecords drops a record the catalogue has no
// cover and no clip for and puts the next one up in its place, which is
// right when there IS a next one. When Apple is throttling there is not:
// every record on the shelf comes back with nothing, every one of them
// is judged dead, and the shelf renders as no records at all. Not blank
// sleeves - an empty wooden board where a page that worked an hour ago
// used to be. That is "the shelves don't load".
//
// So the component has to put the passed-over ones back rather than
// show nothing, and a record nobody can find a picture for has to draw
// as a printed white label so it can still be read and reviewed.
{
  const src = readFileSync("src/components/ShelfRecords.tsx", "utf8");
  check(
    "a shelf puts back what it passed over rather than emptying",
    /passedOver/.test(src) && /shown\.length < SHOW/.test(src)
  );
  check(
    "a record with no cover is printed, not blank",
    /wood-label-print/.test(src)
  );
  check(
    "a record that brought its own video is never judged dead",
    /!record\.videoId/.test(src)
  );
}
{
  const film = readFileSync("src/components/FilmShelf.tsx", "utf8");
  check("a film case with no artwork is printed too", /wood-label-print/.test(film));
}


// ---- an empty shelf is not an outage ----
//
// A shelf headed UK R&B showed "Couldn't reach Last.fm just now. The
// picks come back as soon as it does." over an empty board. Both halves
// were wrong. That shelf does not come from Last.fm - it is one of the
// sixteen that come from YouTube - and discoveryStatus cannot tell
// "Last.fm answered with nothing" from "Last.fm did not answer", since
// every helper returns an empty array for both. So a genuinely thin tag
// was reported as an outage, and somebody waiting for it to clear would
// have waited forever.
//
// A missing key is the only one of those states that is actually
// knowable, so it is the only one the page may claim.
{
  const page = readFileSync("src/app/shelves/page.tsx", "utf8");
  check(
    "only a missing key is reported as a configuration problem",
    /status === "not-configured"/.test(page) && /describeDiscoveryStatus\(status\)/.test(page)
  );
  check(
    "an empty shelf is not reported as an outage",
    !/describeDiscoveryStatus\(discoveryStatus\(/.test(page)
  );
  check(
    "an empty shelf asks for a review instead",
    /Post a \$\{shelfTitle\(axis, value\)\} record/.test(page)
  );
  // The source that cannot fail. When both catalogues have nothing, the
  // records people here have posted still fill the shelf.
  check("a thin shelf is filled from the site's own posts", /getShelfFromPosts/.test(page));
}


// ---- the people here are on the shelves ----
//
// A wall of UK R&B built entirely out of a catalogue, with a member's
// own UK R&B record sitting on another page unable to get on it, is the
// wrong way round for a site about what the people here are making.
// artist_posts had no genre, so it could not be filed anywhere.
{
  const posts = readFileSync("src/lib/shelfPosts.ts", "utf8");
  check("a shelf reads what members made, not only what they reviewed", /artist_posts/.test(posts));
  check("and what members made leads", posts.indexOf("...made, ...reviewed") !== -1);
  const form = readFileSync("src/components/ArtistPostForm.tsx", "utf8");
  check("sharing your own work lets you say what it is", /StandaloneGenrePicker/.test(form));
  const action = readFileSync("src/app/actions/artistPosts.ts", "utf8");
  check("and the genre is validated, not trusted", /isGenreFor\("music", rawGenre\)/.test(action));
  // 019 is not a prerequisite. A post still goes up without it, exactly
  // as it did before the column existed.
  check(
    "a post still goes up before migration 019 is run",
    /isMissingSchema\(error\.message\)/.test(action)
  );
}

// ---- an empty shelf says which thing failed ----
//
// A missing key, a spent daily allowance and a genuinely thin corner
// are three different problems and only one of them means "try another
// divider". The film shelves have said this for months; the music ones
// were shrugging.
{
  const page = readFileSync("src/app/shelves/page.tsx", "utf8");
  check("a music shelf reports the search failure it got", /describeSearchFailure\(shelf\.failure\)/.test(page));
  const scenes = readFileSync("src/lib/youtubeScenes.ts", "utf8");
  check("and the scene shelf carries one back", /failure\?: SearchFailure/.test(scenes));
}


// ---- a scene shelf does not depend on one service ----
//
// The sixteen internet scenes were built from YouTube alone, and
// YouTube failed three different ways in three days: no key, a spent
// daily allowance, and a burst limit that survived being queued AND
// retried. Each time the shelf was empty with an apology on it.
//
// A shelf that only works when one service is happy is a shelf that is
// empty whenever it is not. There are three sources behind it now:
// YouTube names a scene best, Last.fm's tags are the only real genre
// data going, and the site's own posts cannot fail at all.
{
  const shelves = readFileSync("src/lib/shelves.ts", "utf8");
  // The CALL, not the import. The first version of this matched the
  // import line and stayed green with the fallback deleted, which is the
  // same mistake the Deezer matching check made - a check that passes
  // while the thing it checks is gone is worse than no check.
  // The ORDER, which is the whole of the second fix.
  //
  // The first fix replaced a Deezer text search with real tag data and
  // aimed it at the wrong source: YouTube ran first, and asking YouTube
  // for "uk r&b" is the same text search wearing a different logo. With
  // budget in hand YouTube always answered, so the tag path never ran
  // and the reader saw no change at all. The tag has to LEAD.
  const tagAt = shelves.indexOf("await sceneShelfFromArtists(value, tag, known, rotateBy)");
  const youtubeAt = shelves.indexOf("await getYoutubeSceneShelf(");
  check("a scene shelf is built from the tag's artists", tagAt !== -1);
  check("and the tag is asked BEFORE the YouTube phrase search", tagAt !== -1 && tagAt < youtubeAt);
  check(
    "and before giving up on the catalogues",
    tagAt !== -1 && tagAt < shelves.indexOf("getTracksByTag(tag, 120)")
  );

  // "Wait a few seconds and try again" must not be shown on a shelf
  // that has already tried three other sources. Waiting would not help.
  const page = readFileSync("src/app/shelves/page.tsx", "utf8");
  check(
    "only a fixable failure is reported to the reader",
    /reason === "not-configured" \|\| shelf\.failure\.reason === "key-rejected"/.test(page)
  );
}


// ---- the records on a genre shelf are actually of that genre ----
//
// Reported, and correctly: "I went through the genres up here and the
// jams up here not the jams at all. It looks like they just used the
// filter to find the names." That is exactly what it was doing. The
// fallback SEARCHED Deezer for the scene's name, and searching for
// "uk r&b" returns records whose title contains those words rather than
// records that are UK R&B.
//
// A tag is a different question: it is a person saying this artist IS
// this thing. So the shelf walks the tag to its artists and then into
// their catalogues, and every record on it is by somebody the crowd put
// in that scene.
{
  const shelves = readFileSync("src/lib/shelves.ts", "utf8");
  const lastfm = readFileSync("src/lib/lastfm.ts", "utf8");
  const deezer = readFileSync("src/lib/deezer.ts", "utf8");

  check(
    "a scene shelf is built from artists a tag names",
    /getArtistsByTag\(tag, 100\)/.test(shelves)
  );
  check(
    "and from those artists' own catalogues",
    /getArtistTopTracks\(artist, 12\)/.test(shelves)
  );
  // The function, not the import or a mention in a comment. A signature
  // is the one thing a deletion cannot leave behind.
  check(
    "tag.getTopArtists is what answers that",
    /export async function getArtistsByTag\(/.test(lastfm) &&
      /method=tag\.gettopartists/.test(lastfm)
  );

  // The whole bug, gone rather than unused. Left in the file, the next
  // person looking for a way to fill an empty shelf finds it and reaches
  // for it, and the shelves fill up with search results again.
  check(
    "the text-search scene shelf no longer exists",
    !/export async function getDeezerSceneShelf/.test(deezer)
  );
  check("and nothing calls it", !/await getDeezerSceneShelf\(/.test(shelves));

  // A thin tag goes deeper into the scene rather than showing six
  // records - but only a scene. An artist tagged "1994" is not a 1994
  // artist, they are somebody who released a record that year, so
  // walking their catalogue would hand a Year shelf every other year
  // they ever worked.
  check(
    "a thin scene tops up from its artists",
    /axis === "scene" && shelf\.length < SHELF_SIZE/.test(shelves)
  );
  check(
    "and a year or a place does not",
    !/axis === "year" && shelf\.length < SHELF_SIZE/.test(shelves) &&
      !/axis === "place" && shelf\.length < SHELF_SIZE/.test(shelves)
  );

  // Popularity order, reversed. tag.getTopArtists leads with the names
  // everybody already knows, and these shelves exist for the people who
  // do not have an audience yet - which is what was asked for: "find
  // people that maybe don't even have an audience".
  check(
    "the shelf leads with the least famous of the scene",
    /rotate\(\[\.\.\.artists\]\.reverse\(\), rotateBy\)/.test(shelves)
  );
  // Anchored at the end. Without the boundary this matched `taken >= 30`
  // happily, so the cap could be lifted to thirty - one artist filling
  // the whole shelf - and the check would still say three.
  check("and holds three to an artist like the others", /taken >= 3\)/.test(shelves));

  // ---- the site's own artists are on their own scene's shelf ----
  //
  // "i dont see kwn in sasha keable", after asking for them twice
  // before. They were in SEED_ARTISTS, which ONLY the Discover engine
  // reads - the shelves had never looked at it, so a small artist could
  // sit in this repo forever and never reach the one shelf they belong
  // on, because Last.fm's tag chart is ordered by popularity and does
  // not name them.
  check("the roster leads its scene's shelf", /const placed = rosterFor\(scene\);/.test(shelves));

  // ---- an artist nobody could place is placed by the people who listen ----
  //
  // "i meant braker and tezzus idk what he fits under". Neither did I,
  // and a guess here puts a real person on a shelf they are not on -
  // which is the failure this area has been fixed for twice already. So
  // the artist is asked ABOUT rather than assigned: if people have
  // tagged Tezzus with the scene being built, he leads it.
  check(
    "an unplaced artist's own tags are asked for",
    /ROSTER_UNPLACED\.map\(async \(artist\) => \(\{/.test(shelves) &&
      /await getArtistTags\(artist\)/.test(shelves)
  );
  check(
    "and they lead the shelf their tags name",
    /tags\.some\(\(t\) => sameTag\(t, tag\) \|\| sameTag\(t, scene\)\)/.test(shelves)
  );
  check(
    "and they are asked alongside the tag chart, not after it",
    /await Promise\.all\(\[\s*\n\s*getArtistsByTag\(tag, 100\)/.test(shelves)
  );
  // Tezzus is NOT filed under a specific scene by me.
  check(
    "Tezzus and Braker are unplaced rather than guessed",
    ROSTER_UNPLACED.includes("Tezzus") && ROSTER_UNPLACED.includes("Braker")
  );
  // But they are not invisible while nobody has tagged them either.
  check(
    "and they still have a broad shelf in the meantime",
    rosterFor("underground-hip-hop").includes("Tezzus") &&
      rosterFor("underground-hip-hop").includes("Braker")
  );
  // The comparison has to survive punctuation, or a tag reading
  // "underground hip hop" never matches the slug "underground-hip-hop"
  // and none of this does anything at all.
  check(
    "a tag matches its slug through the punctuation",
    sameTag("underground hip hop", "underground-hip-hop") &&
      sameTag("UK R&B", "uk-rnb") &&
      !sameTag("plugg", "pluggnb")
  );
  check(
    "and it is not rotated away on some days",
    /\[\.\.\.ours, \.\.\.rotated\.filter\(/.test(shelves)
  );
  // "DEEP CUTS OF ALL ARTIST GO DEEP" - so the hits are skipped for
  // everybody, roster included: Whitney Houston is the album track.
  check(
    "deep cuts are the rule for everyone, roster included",
    /let deep = excludeHits\(tracks\.slice\(2\)\);/.test(shelves)
  );
  // But going deep on somebody with four uploads empties the catalogue
  // and the artist never appears at all, which is the complaint. They
  // give up the deep cut rather than their place on the shelf.
  check(
    "and a small roster artist appears rather than going deep into nothing",
    /if \(mine && deep\.length === 0\) deep = tracks\.slice\(2\);/.test(shelves) &&
      /if \(mine && deep\.length === 0\) deep = tracks;/.test(shelves)
  );
  // The fallback is the ROSTER's alone. A big name off the tag chart
  // must never reach it, or the shelf fills with the hits it exists to
  // avoid.
  check(
    "and a tag-chart name never gets that fallback",
    !/if \(deep\.length === 0\) deep = tracks;/.test(shelves)
  );
  check(
    "and the shelf still fills even when the tag chart is empty",
    /if \(artists\.length === 0 && ours\.length === 0\) return \[\];/.test(shelves)
  );
  // The names that were actually asked for, on the shelf they were
  // asked for.
  check(
    "KWN and Sasha Keable are filed under UK R&B",
    rosterFor("uk-rnb").includes("KWN") && rosterFor("uk-rnb").includes("Sasha Keable")
  );
  // Every roster scene has to be a real genre slug, or its artists are
  // filed under a shelf that does not exist and silently never appear.
  for (const scene of Object.keys(SCENE_ROSTER)) {
    check(`the roster scene ${scene} is a real genre`, isGenreFor("music", scene));
  }
}


console.log(failures === 0 ? "\nYou pick the shelf; it does not pick for you." : `\n${failures} failing.`);
process.exit(failures === 0 ? 0 : 1);