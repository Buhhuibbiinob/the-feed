import { parseYoutubeId } from "@/lib/mediaSlots";
import type { ArtistPlatform } from "@/lib/artistPlatforms";

// Playing a record somebody here actually made.
//
// An artist post was a link and nothing else: a badge saying YouTube, a
// name, and a button that took you off the site. Which is the wrong way
// round for the one thing on here that is not a catalogue - a member's
// own track, the reason somebody joined, and the only music on the site
// you cannot hear without leaving it.
//
// Every one of these four services publishes a keyless embed. So the
// record plays where it is.
//
// This is not the same question as whether a SHELF plays video. A shelf
// is a wall of records to look through and a video player in it is
// noise; a page about one track somebody made is exactly where the
// thing should play.

export type ArtistEmbed =
  | { kind: "youtube"; videoId: string }
  | { kind: "spotify"; path: string }
  | { kind: "soundcloud"; url: string }
  | { kind: "apple"; path: string };

/**
 * Spotify's embed works for a track, an album or an artist, and an
 * artist post can legitimately be any of those - somebody sharing "here
 * is my project" rather than one single. So the whole path is carried
 * rather than a track id.
 */
function spotifyPath(url: URL): string | null {
  const match = url.pathname.match(/^\/(track|album|artist|playlist)\/([A-Za-z0-9]+)/);
  return match ? `${match[1]}/${match[2]}` : null;
}

function applePath(url: URL): string | null {
  // music.apple.com/<storefront>/<kind>/<slug>/<id>
  const match = url.pathname.match(/^\/([a-z]{2})\/(album|song|artist|playlist)\/([^/]+)\/([^/?#]+)/i);
  return match ? `${match[1]}/${match[2]}/${match[3]}/${match[4]}` : null;
}

/**
 * What to embed for one artist post, or nothing.
 *
 * Nothing is a real answer: a link to somebody's profile page rather
 * than to a record has no player, and the page keeps its "open it
 * there" button for those. Better than an empty frame.
 */
export function artistEmbed(platform: ArtistPlatform, linkUrl: string): ArtistEmbed | null {
  let url: URL;
  try {
    url = new URL(linkUrl);
  } catch {
    return null;
  }

  if (platform === "youtube") {
    const videoId = parseYoutubeId(linkUrl);
    return videoId ? { kind: "youtube", videoId } : null;
  }
  if (platform === "spotify") {
    const path = spotifyPath(url);
    return path ? { kind: "spotify", path } : null;
  }
  if (platform === "apple_music") {
    const path = applePath(url);
    return path ? { kind: "apple", path } : null;
  }
  if (platform === "soundcloud") {
    // SoundCloud's player takes the track URL itself rather than an id,
    // and it is the one that matters most here: it is where people who
    // have not put a record in a store put their music.
    if (!/^\/[^/]+\/[^/]+/.test(url.pathname)) return null;
    return { kind: "soundcloud", url: `${url.origin}${url.pathname}` };
  }
  return null;
}

/** The src an iframe should load for it. */
export function artistEmbedSrc(embed: ArtistEmbed): string {
  switch (embed.kind) {
    case "youtube":
      return `https://www.youtube-nocookie.com/embed/${embed.videoId}`;
    case "spotify":
      return `https://open.spotify.com/embed/${embed.path}?utm_source=generator&theme=0`;
    case "apple":
      return `https://embed.music.apple.com/${embed.path}`;
    case "soundcloud":
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(
        embed.url
      )}&color=%23555555&auto_play=false&show_teaser=false`;
  }
}
