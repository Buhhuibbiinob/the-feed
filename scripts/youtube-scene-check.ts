/**
 * The scenes that come from YouTube, and what gets on their shelves.
 *
 * Sixteen genres cannot be built from Last.fm - digicore, sigilkore,
 * HexD, UK R&B, alte and the rest happened on YouTube rather than on
 * scrobblers, and asking Last.fm for those charts returns nothing,
 * which draws as a shelf saying nobody makes this about a scene with
 * more releases in a week than half the tags around it.
 *
 * Building a shelf out of search results means reading an artist and a
 * title off a video title, and that is guesswork with two bad outcomes.
 * Guess too eagerly and the shelf fills with records whose artist is a
 * channel name - indistinguishable from a real one until somebody
 * presses it. Guess too timidly and the shelf is empty, which is what
 * this was meant to fix.
 *
 * So the parser is pinned to real title shapes here, both the ones it
 * must read and the ones it must refuse.
 *
 * Run: npx tsx scripts/youtube-scene-check.ts
 */
import { GENRES } from "../src/lib/genres";
import { tagText } from "../src/lib/lastfm";
import {
  YOUTUBE_SCENES,
  isYoutubeScene,
  parseVideoTitle,
  sceneQuery,
} from "../src/lib/youtubeScenes";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

function parse(title: string, channelTitle = "a channel") {
  return parseVideoTitle({ id: "v", title, channelTitle, thumbnailUrl: null });
}

// Every scene named here has to be a real genre, or it is a shelf that
// can never be reached and a promise the picker does not keep.
for (const slug of YOUTUBE_SCENES) {
  check(`${slug} is a real music genre`, GENRES.music.includes(slug));
}
check("the list is the sixteen scenes", YOUTUBE_SCENES.size === 16, `${YOUTUBE_SCENES.size}`);
check("a Last.fm scene is not routed to YouTube", !isYoutubeScene("shoegaze"));

// The shapes a music upload actually takes.
const READS: [string, string, { name: string; artist: string }][] = [
  ["Sasha Keable - Killing Me (Official Video)", "ch", { artist: "Sasha Keable", name: "Killing Me" }],
  ["KWN — Faded", "ch", { artist: "KWN", name: "Faded" }],
  ["jane remover - Contingency Song", "ch", { artist: "jane remover", name: "Contingency Song" }],
  ['Cleo Sol "Sunshine" [Official Audio]', "ch", { artist: "Cleo Sol", name: "Sunshine" }],
  // A Topic channel is the catalogue upload: the channel knows the
  // artist even when the title is only the song.
  ["funeral", "Tezzus - Topic", { artist: "Tezzus", name: "funeral" }],
];
for (const [title, channel, want] of READS) {
  const got = parse(title, channel);
  check(
    `reads ${JSON.stringify(title)}`,
    got?.artist === want.artist && got?.name === want.name,
    got ? JSON.stringify(got) : "skipped it"
  );
}

// The things that rank well for a scene name and are not a record. A
// mix on the shelf is the worst kind of wrong: a sleeve with a name
// that is not a song by an artist who is not an artist.
const REFUSES = [
  ["DIGICORE MIX 2024 (1 hour)", "ch"],
  ["best of uk r&b playlist", "ch"],
  ["sigilkore type beat", "ch"],
  ["jersey club full album", "ch"],
  ["reaction to alte", "ch"],
  // No separator and no Topic channel: the artist is genuinely unknown,
  // and inventing one from the channel name is how a shelf fills up
  // with records by "Lofi Girl".
  ["gorgeous", "some uploader"],
];
for (const [title, channel] of REFUSES) {
  check(`refuses ${JSON.stringify(title)}`, parse(title, channel) === null);
}

// One search per scene per day is the budget. The query varies by day
// so the shelf is different records tomorrow, but only ONE of the
// shapes is ever used on a given day - if that stopped being true the
// cost would multiply by however many shapes there are.
const day3 = new Set(YOUTUBE_SCENES);
check(
  "a scene asks exactly one way on a given day",
  [...day3].every((slug) => typeof sceneQuery(tagText(slug), 3) === "string")
);
const shapes = new Set([0, 1, 2, 3, 4, 5, 6, 7].map((d) => sceneQuery("uk r&b", d)));
check("the query changes across days", shapes.size > 1, `${shapes.size} shapes`);
check(
  "and comes back to itself, so the cache is reused",
  sceneQuery("uk r&b", 0) === sceneQuery("uk r&b", 4)
);
// The slug is never asked for raw: "uk-rnb" finds nothing on YouTube
// and "uk r&b" finds the scene.
check("a scene is searched as words, not as a slug", !sceneQuery(tagText("uk-rnb"), 0).includes("-"));

console.log(
  failures === 0
    ? "\nThe YouTube scenes are real genres, and only real songs get on their shelves."
    : `\n${failures} problem(s) with the YouTube shelves.`
);
process.exit(failures === 0 ? 0 : 1);
