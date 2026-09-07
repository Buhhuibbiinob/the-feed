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
import {
  PROVIDERS,
  PROVIDER_LABELS,
  embedUrl,
  openUrl,
  parsePlaylistUrl,
} from "../src/lib/playlists";

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

// ---- The shapes people actually paste ---------------------------------
//
// Every one of these was reported as "that doesn't look like a playlist
// link", about links that came straight off Spotify's and Apple's own
// share buttons. A parser that is too strict does not fail safe: it
// tells somebody their working link is broken, and they believe it,
// because why would the site be wrong about its own field.

for (const [url, why] of [
  ["https://music.apple.com/us/playlist/pl.f4d106fed2bd41149aaacabb233eb5eb", "Apple hands out links with no slug"],
  ["https://music.apple.com/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb", "and links with no storefront"],
  ["37i9dQZF1DXcBWIGoYBM5M", "the comment promised a bare id worked, and it never did"],
  ["https://open.spotify.com/intl-de/playlist/37i9dQZF1DXcBWIGoYBM5M", "Spotify puts a locale in the path now"],
  ["https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=8f2a1c0e9b4d4a71", "the share token comes with it"],
] as [string, string][]) {
  check(`accepts a real link - ${why}`, !!parsePlaylistUrl(url), url);
}

// Still fussy about the things that are genuinely not playlists, since
// an album pasted into a playlist box would embed as an empty player.
for (const url of [
  "https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3",
  "https://open.spotify.com/track/1DFixLWuPkv3KT3TnV35m3",
  "https://music.apple.com/us/album/abbey-road/1441164426",
  "hello",
  "",
]) {
  check(`still rejects ${url || "an empty box"}`, !parsePlaylistUrl(url));
}

// ---- Six services, and only playlists from any of them ---------------
//
// The test that matters is not "is this a link to a music site". It is
// "is this a PLAYLIST". A track, an album, an artist page and a bare
// video all come from the same hostnames and none of them belongs here:
// pasted in, they would embed as an empty player or as one song, and the
// person who pasted it would have no idea why.

for (const [url, provider, why] of [
  ["https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI", "youtube", "the playlist page"],
  ["https://music.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI", "youtube", "YouTube Music, same playlists"],
  ["https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI", "youtube", "a video opened from inside a playlist"],
  ["https://soundcloud.com/someone/sets/late-nights", "soundcloud", "a set"],
  ["https://www.deezer.com/en/playlist/1963962142", "deezer", "with a locale"],
  ["https://www.deezer.com/playlist/1963962142", "deezer", "without one"],
  ["https://tidal.com/browse/playlist/1c5d01ed-4f05-40c4-bd28-0f73099e9648", "tidal", "via browse"],
  ["https://listen.tidal.com/playlist/1c5d01ed-4f05-40c4-bd28-0f73099e9648", "tidal", "via listen"],
] as [string, string, string][]) {
  const p = parsePlaylistUrl(url);
  check(`${provider}: ${why}`, p?.provider === provider, p ? `read as ${p.provider}` : "refused");
}

for (const url of [
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://youtu.be/dQw4w9WgXcQ",
  "https://soundcloud.com/someone/a-single-track",
  "https://www.deezer.com/en/album/1963962142",
  "https://tidal.com/browse/album/1c5d01ed-4f05-40c4-bd28-0f73099e9648",
  "https://open.spotify.com/artist/1DFixLWuPkv3KT3TnV35m3",
  "https://example.com/playlist/123",
]) {
  check(`not a playlist: ${url}`, !parsePlaylistUrl(url));
}

// Every provider has to be able to say where it embeds and where it
// opens, or it is a row in the database nothing can render.
for (const provider of PROVIDERS) {
  const fake = { provider, providerId: "abc123", storefront: "us", slug: "x" } as const;
  check(
    `${provider} knows how to embed and open`,
    embedUrl(fake).startsWith("https://") && openUrl(fake).startsWith("https://"),
    `${embedUrl(fake)} | ${openUrl(fake)}`
  );
  check(`${provider} has a label`, !!PROVIDER_LABELS[provider]);
}

console.log(failures === 0 ? "\nPaste a link, get the playlist." : `\n${failures} failing.`);
process.exit(failures === 0 ? 0 : 1);
