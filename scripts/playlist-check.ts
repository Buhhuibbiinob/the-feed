import { readFileSync } from "node:fs";
/**
 * Pasting a playlist link.
 *
 * URL parsing is where a feature like this rots: somebody pastes the
 * link with a share token on it, or the mobile app's link, or a URI
 * rather than a URL, and the box says "that doesn't look like a
 * playlist" about a link that plainly is one. Every shape here is one
 * the two apps really produce.
 *
 * Run: npx tsx scripts/playlist-check.ts
 */
import { embedUrl, openUrl, parsePlaylistUrl } from "../src/lib/playlists";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
  if (!ok) failures++;
}

const SPOTIFY_ID = "37i9dQZF1DXcBWIGoYBM5M";

// ---- what Spotify's share sheet hands you -----------------------------

const spotifyShapes: [string, string][] = [
  ["the web link", `https://open.spotify.com/playlist/${SPOTIFY_ID}`],
  ["with the share token", `https://open.spotify.com/playlist/${SPOTIFY_ID}?si=8a2b1c0d`],
  ["with a locale in the path", `https://open.spotify.com/intl-de/playlist/${SPOTIFY_ID}`],
  ["the copy-URI form", `spotify:playlist:${SPOTIFY_ID}`],
  ["without the scheme", `open.spotify.com/playlist/${SPOTIFY_ID}`],
  ["with http", `http://open.spotify.com/playlist/${SPOTIFY_ID}`],
  ["with a trailing slash", `https://open.spotify.com/playlist/${SPOTIFY_ID}/`],
  ["surrounded by spaces", `  https://open.spotify.com/playlist/${SPOTIFY_ID}  `],
];
for (const [name, url] of spotifyShapes) {
  const p = parsePlaylistUrl(url);
  check(`Spotify ${name}`, p?.provider === "spotify" && p.providerId === SPOTIFY_ID, p ? p.providerId : "not recognised");
}

// ---- what Apple Music hands you ---------------------------------------

const APPLE = "https://music.apple.com/gb/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb";
const apple = parsePlaylistUrl(APPLE);
check("an Apple Music link", apple?.provider === "apple");
check("its id", apple?.providerId === "pl.f4d106fed2bd41149aaacabb233eb5eb", apple?.providerId);
check("its storefront", apple?.storefront === "gb", "the embed will not load from the wrong storefront");
check("its slug", apple?.slug === "todays-hits", apple?.slug ?? "");
check(
  "a personal playlist id",
  parsePlaylistUrl("https://music.apple.com/us/playlist/late-nights/pl.u-2aAX5V9Cx3M8dq")?.providerId ===
    "pl.u-2aAX5V9Cx3M8dq",
  "member playlists start pl.u- and were the whole point"
);
check(
  "an embed link pasted back in",
  parsePlaylistUrl("https://embed.music.apple.com/us/playlist/x/pl.abc123")?.providerId === "pl.abc123",
  "somebody copying from an embed is pasting a real link"
);
check(
  "with a query string",
  parsePlaylistUrl(`${APPLE}?l=en-GB`)?.providerId === "pl.f4d106fed2bd41149aaacabb233eb5eb"
);

// ---- what is not a playlist -------------------------------------------

const notPlaylists = [
  ["nothing", ""],
  ["whitespace", "   "],
  ["a sentence", "check out my playlist"],
  ["a Spotify ALBUM", `https://open.spotify.com/album/${SPOTIFY_ID}`],
  ["a Spotify track", `https://open.spotify.com/track/${SPOTIFY_ID}`],
  ["an Apple ALBUM", "https://music.apple.com/gb/album/blonde/1146195596"],
  ["an Apple artist", "https://music.apple.com/gb/artist/frank-ocean/442122051"],
  ["a YouTube playlist", "https://www.youtube.com/playlist?list=PLabc"],
  ["a lookalike host", `https://open.spotify.com.evil.example/playlist/${SPOTIFY_ID}`],
  ["a path that only contains the word", "https://example.com/playlist/abc"],
];
for (const [name, url] of notPlaylists) {
  check(`${name} is refused`, parsePlaylistUrl(url) === null, JSON.stringify(parsePlaylistUrl(url)));
}
check("a non-string is refused", parsePlaylistUrl(undefined) === null && parsePlaylistUrl(42) === null);

// ---- the embed --------------------------------------------------------

check(
  "Spotify embeds from its embed host",
  embedUrl(parsePlaylistUrl(spotifyShapes[0][1])!) === `https://open.spotify.com/embed/playlist/${SPOTIFY_ID}`
);
check(
  "the share token does not travel into the embed",
  !embedUrl(parsePlaylistUrl(spotifyShapes[1][1])!).includes("si="),
  "a share token is somebody's own, and it has no business being republished"
);
check(
  "Apple embeds keep the storefront",
  embedUrl(apple!) ===
    "https://embed.music.apple.com/gb/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb"
);
check(
  "the link out is the real page, not the embed",
  openUrl(apple!).startsWith("https://music.apple.com/") && !openUrl(apple!).includes("embed.")
);

// A slug with something odd in it must not break out of the path.
const odd = parsePlaylistUrl("https://music.apple.com/us/playlist/a%2Fb%3Fc/pl.xyz789");
check("an awkward slug is escaped, not passed through", !!odd && !embedUrl(odd).includes("a/b?c"), odd ? embedUrl(odd) : "");

// ---- The shelf loads one player, not all of them ----
//
// The wall used to render an embed per playlist. Twelve players all
// connecting on load is a slow tab where eleven of them are below the
// fold, and it is the sort of thing that creeps back the moment somebody
// finds the click-to-play step annoying while testing.
{
  const wall = readFileSync("src/components/PlaylistWall.tsx", "utf8");
  const iframes = (wall.match(/<iframe/g) ?? []).length;
  check(
    "only the tape somebody presses connects to anything",
    iframes === 1,
    iframes === 1 ? "one iframe in the component" : `${iframes} iframes, which is one per playlist again`
  );
  // Position, not a lazy regex across the map: `map( ... <iframe` matches
  // whenever the iframe is anywhere after the map at all, which it always
  // is. What actually matters is that the player is inside the block that
  // renders the ONE chosen tape.
  const deckStart = wall.indexOf("{playing && (");
  const iframeAt = wall.indexOf("<iframe");
  check(
    "the player sits under the shelf rather than inside the list, so adding a playlist does not add a player",
    deckStart >= 0 && iframeAt > deckStart
  );
  check(
    "nothing plays until somebody picks a tape, because a shelf that starts playing at you has decided for you",
    /useState<string \| null>\(null\)/.test(wall)
  );
}

console.log(failures === 0 ? "\nPaste a link, get the playlist." : `\n${failures} failing.`);
process.exit(failures === 0 ? 0 : 1);
