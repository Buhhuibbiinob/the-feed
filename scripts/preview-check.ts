/**
 * A record you cannot see should at least be a record you can play.
 *
 * The covers and the clips arrive from the same lookup, and every time
 * this area has broken it has broken the same way: something treated
 * "Apple would not answer just now" as "this record has nothing", wrote
 * that down, and left a square with no picture AND no play button. That
 * is a dead record on the shelf, and it is the worst of the three
 * possible outcomes - worse than a blank sleeve you can hear, and worse
 * than no record at all.
 *
 * So the two rules that keep a clip attached to a coverless record are
 * checked rather than trusted:
 *
 *  1. A refusal is never remembered as an answer, anywhere.
 *  2. A component that already has a clip in hand uses it instead of
 *     asking again - because the second ask is the one that gets
 *     refused, and then the record it had a clip for has none.
 *
 * Run: npx tsx scripts/preview-check.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { worthRemembering } from "../src/lib/coverCache";

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else if (path.endsWith(".ts") || path.endsWith(".tsx")) out.push(path);
  }
  return out;
}
const SOURCES = walk("src");

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

const found = { artworkUrl: "a", previewUrl: "p", trackUrl: null, year: null };
const artOnly = { artworkUrl: "a", previewUrl: null, trackUrl: null, year: null };
const clipOnly = { artworkUrl: null, previewUrl: "p", trackUrl: null, year: null };
const nothing = { artworkUrl: null, previewUrl: null, trackUrl: null, year: null };
const refused = { ...nothing, throttled: true };

check("a real answer is remembered", worthRemembering(found, false));
check("a cover with no clip is still an answer", worthRemembering(artOnly, false));
// The case this whole check exists for. A record Apple has a preview
// for but no artwork is a blank sleeve you can play, which is a record.
check("a clip with no cover is still an answer", worthRemembering(clipOnly, false));
check("a refusal is never remembered", !worthRemembering(refused, true));
check("a refusal is never remembered, shallow either", !worthRemembering(refused, false));
// A plain search is a relevance search: it misses tracks the artist's
// own catalogue has. Writing that miss down as fact is how a playable
// record becomes permanently unplayable for everybody.
check("a shallow miss is NOT remembered as 'Apple has nothing'", !worthRemembering(nothing, false));
check("a deep miss IS remembered", worthRemembering(nothing, true));

// Every caller of the single-sleeve route has to tell a refusal from an
// answer. The route says 503 for a throttle; a caller that goes straight
// to res.json() reads that as a record with no clip and records it.
const CALLERS = [
  "src/components/Crate.tsx",
  "src/components/RecordRack.tsx",
  "src/components/YourShelf.tsx",
];
for (const file of CALLERS) {
  const src = readFileSync(file, "utf8");
  if (!src.includes("/api/crate/sleeve?")) {
    check(`${file} still asks for sleeves`, false, "the check is out of date");
    continue;
  }
  const handles = /res\.ok|res\.status === 503|status === 503/.test(src);
  check(`${file} tells a refusal from an answer`, handles);
}

// The rack looks up a screenful at a time and gets the clips with the
// covers. Reaching for the network again for a clip already in memory
// is a request that can be refused, and a refused one takes the play
// button off a record that had one.
const rack = readFileSync("src/components/RecordRack.tsx", "utf8");
check(
  "the rack plays the clip it already batched before the one it fetched",
  /heldInfo\?\.previewUrl\s*\?\?\s*pulled/.test(rack)
);
check(
  "the rack does not fetch a clip it already has",
  /alreadyHave[\s\S]{0,120}?heldInfo\?\.previewUrl/.test(rack)
);

// The batch route asks a second time, properly, for the records that
// came back with nothing at all. That pass is where a coverless record
// gets its clip.
const batch = readFileSync("src/app/api/crate/sleeves/route.ts", "utf8");
check("the batch goes back for the records that came back empty", /nothingFound/.test(batch));
check("...and that second pass uses the catalogue fallback", /pool\(nothingFound[\s\S]{0,40}?,\s*true\)/.test(batch));

// ---- a record plays its clip, and nothing else ----
//
// The shelves, the crate and the racks used to fall back to a YouTube
// embed for a record no catalogue had a preview for. That was the wrong
// answer to the right problem: a wall of records is not a place to
// watch anything, and a sleeve that turns into a video player is not a
// sleeve.
//
// The right answer was the second catalogue. Between Apple and Deezer
// far more records have a real 30-second clip than either had alone,
// and where there is genuinely none the record still stands there with
// its name printed on it - readable, and reviewable, which is the thing
// this site is actually for.
//
// So no music surface may embed a video. Film keeps its trailer: a
// trailer IS the thing, in the way a music video is not.
const MUSIC_SURFACES = [
  "src/components/ShelfRecords.tsx",
  "src/components/RecordRack.tsx",
  "src/components/YourShelf.tsx",
];
for (const file of MUSIC_SURFACES) {
  const src = readFileSync(file, "utf8");
  check(`${file} plays a clip, not a video`, !/youtube\.com\/embed/.test(src));
}
// The crate holds both, so it is checked more precisely: the only embed
// in it has to be the film branch.
{
  const crate = readFileSync("src/components/Crate.tsx", "utf8");
  const embeds = crate.split("\n").filter((l) => l.includes("youtube.com/embed"));
  check("the crate embeds only a film trailer", embeds.length === 1, embeds.join(" | "));
  check(
    "and only on the film branch",
    /current\.kind === "film" && playing && current\.videoId/.test(crate)
  );
}
// ---- but a review DOES play the video ----
//
// The line is not "no video anywhere". It is about which surface. A
// shelf is a wall of records to look through and a player in it is
// noise; a review is about ONE record, and a song somebody uploaded is
// the whole reason they posted. Those play.
//
// Checked from both directions, because a rule enforced in one
// direction only is how the shelves lost their embeds and the reviews
// nearly went with them.
{
  const card = readFileSync("src/components/PostCard.tsx", "utf8");
  check("a review still carries a player", /PreviewPlayer/.test(card));
  const player = readFileSync("src/components/PreviewPlayer.tsx", "utf8");
  // Through YoutubeSlot now rather than a bare iframe, so the assertion
  // is that it still plays video at all - not which tag it uses.
  check("and that player plays video", /<YoutubeSlot/.test(player));
  const form = readFileSync("src/components/PostForm.tsx", "utf8");
  check(
    "a song picked for a review is given its video",
    /resolveTrackVideo\(/.test(form)
  );
  // And the path that does NOT go through the search box, which is most
  // of them: a review started from Discover, the Crate or a shelf
  // arrives with the title already in the URL and never touches that
  // box. Those were saved with no video and rendered with no player.
  const action = readFileSync("src/app/actions/posts.ts", "utf8");
  check(
    "a review started from a link is given one too",
    /!videoId && !spotifyTrackId && title && \(mediaType === "music" \|\| mediaType === "movie_tv"\)/.test(
      action
    )
  );
  // And when YouTube cannot answer at all. The day's quota being spent
  // meant every review posted after it ran out was saved with no player
  // - which is the third separate way this has failed, so it gets a
  // second source like everything else.
  //
  // A Spotify embed costs no quota and has no daily cap, the posts table
  // already had a column for one, and PreviewPlayer already knew how to
  // render it.
  check(
    "a review falls back to Spotify when YouTube has nothing",
    /lookupSpotifyTrack\(title, artist \|\| ""\)/.test(action)
  );
  check(
    "and editing gives an old review the same second chance",
    /foundSpotify/.test(action)
  );
  check(
    "the player can render a Spotify embed",
    /open\.spotify\.com\/embed\/track/.test(readFileSync("src/components/PreviewPlayer.tsx", "utf8"))
  );

  // A film gets its trailer. This branch only ever considered music, so
  // every film review on the site was saved with no player at all.
  check(
    "a film review gets its trailer",
    /mediaType === "movie_tv"\s*\n?\s*\? `\$\{title\} trailer`/.test(action)
  );

  // And the cover, which is the blank white square in the corner of
  // every feed row. Most reviews are written from Discover or a shelf
  // with the title already filled in, and nothing ever looked one up.
  check("a review is given a cover when it has none", /found\?\.artworkUrl/.test(action));
  check(
    "and a film borrows its trailer's thumbnail",
    /i\.ytimg\.com\/vi\/\$\{videoId\}/.test(action)
  );

  // The feed does what the profile page has done for months.
  const feed = readFileSync("src/app/page.tsx", "utf8");
  check("the feed fills in missing covers too", /await backfillCovers\(/.test(feed));
  // And it reads the shared cache first, which is what makes doing it on
  // a twenty-row feed affordable at all.
  const backfill = readFileSync("src/lib/coverBackfill.ts", "utf8");
  check("the backfill reads the cache before asking anybody", /await readCovers\(/.test(backfill));
  check(
    "and asks all three catalogues rather than the throttled one",
    /await lookupTrack\(/.test(backfill) && !/searchItunesArt/.test(backfill)
  );

  // ---- a refused embed is a picture, not a red box ----
  //
  // The profiles were showing YouTube's error screen where a video
  // should be. That is not the daily quota - an embed costs no quota at
  // all - it is YouTube refusing to play THAT video in an iframe:
  // embedding disabled by the uploader, blocked by a label, taken down,
  // or an id that now points somewhere else. None of those is fixable
  // from here and no amount of retrying touches them.
  //
  // Every video has one thing that always loads, needs no key and asks
  // nobody's permission: its thumbnail. So a video that will not play
  // becomes a picture of itself with a link on it.
  const slot = readFileSync("src/components/YoutubeSlot.tsx", "utf8");
  check("a refused embed falls back to the video's own poster", /i\.ytimg\.com\/vi\//.test(slot));
  check(
    "and the poster is there from the first paint, so the slot is never empty",
    (slot.match(/backgroundImage: `url\(\$\{poster\}\)`/g) ?? []).length >= 2
  );
  // 101 and 150 are "the owner does not allow this video to be played in
  // embedded players", which is the common one.
  check("the codes it listens for include embedding-disabled", /101, 150/.test(slot));
  check("it needs enablejsapi to hear them at all", /enablejsapi: "1"/.test(slot));
  // Messages from anywhere else must not be able to blank a video.
  check(
    "and it only believes messages from YouTube",
    /event\.origin/.test(slot) && /event\.source !== frame\.current\.contentWindow/.test(slot)
  );
  for (const file of ["src/components/ProfileStore.tsx", "src/components/PreviewPlayer.tsx"]) {
    const src = readFileSync(file, "utf8");
    check(`${file} goes through it`, /<YoutubeSlot/.test(src));
    check(`${file} has no bare embed left`, !/youtube(-nocookie)?\.com\/embed/.test(src));
  }

  // ---- and the reviews already written ----
  //
  // Posting fixes reviews from now on. The ones already in the database
  // cannot fix themselves: nothing at render time may spend a YouTube
  // search, because a feed of twenty would be two thousand units per
  // page view against a ten-thousand-unit day.
  const backfillPlayers = readFileSync("src/lib/playerBackfill.ts", "utf8");
  check("there is a way to fix reviews already written", /backfillPlayers/.test(backfillPlayers));
  check(
    "it goes a few at a time rather than all at once",
    /BATCH = 10/.test(backfillPlayers)
  );
  check(
    "it says how many are left, so the cost of finishing is visible",
    /remaining/.test(backfillPlayers)
  );
  // Films get a trailer; music that YouTube cannot answer for gets
  // Spotify. Both, or the backfill has the same blind spots the posting
  // path just had fixed.
  check("it handles films too", /\$\{title\} trailer/.test(backfillPlayers));
  check("and falls back to Spotify", /lookupSpotifyTrack/.test(backfillPlayers));
  // Only reachable by an admin pressing a button, never by a page.
  const adminAction = readFileSync("src/app/actions/admin.ts", "utf8");
  check(
    "and only an admin can run it",
    /adminBackfillPlayers[\s\S]{0,200}?requireAdmin\(\)/.test(adminAction)
  );

  // The two reasons a cover stayed blank on a row that had every chance.
  const covers = readFileSync("src/lib/coverBackfill.ts", "utf8");
  check(
    "a review with no artist can still get a cover",
    !/!post\.artist\?\.trim\(\)/.test(covers)
  );
  check(
    "and a film borrows its trailer's thumbnail rather than being skipped",
    /movie_tv/.test(covers) && /hqdefault/.test(covers)
  );

  // A member's own uploaded track plays on its own page rather than
  // being a link off the site - it is the one piece of music here that
  // is not in anybody's catalogue.
  const artistPage = readFileSync("src/app/artists/[id]/page.tsx", "utf8");
  check("an uploaded track plays on its page", /artistEmbedSrc/.test(artistPage));
  const embeds: string[] = [];
  for (const platform of ["youtube", "spotify", "soundcloud", "apple_music"]) {
    if (readFileSync("src/lib/artistEmbed.ts", "utf8").includes(`"${platform}"`)) {
      embeds.push(platform);
    }
  }
  check("all four services it accepts can play", embeds.length === 4, embeds.join(", "));
}

// The route and the client that spent YouTube quota to play a record
// are gone with the feature, rather than left behind to be rediscovered
// and rewired by somebody later.
check(
  "nothing spends YouTube quota to play a record any more",
  !SOURCES.some((f) => readFileSync(f, "utf8").includes("/api/music/play"))
);

console.log(
  failures === 0
    ? "\nReviews play the video, shelves play the clip, and a coverless record keeps both."
    : `\n${failures} way(s) a record can end up with no cover and nothing to press.`
);
process.exit(failures === 0 ? 0 : 1);
