import { cachedFetch } from "@/lib/cachedFetch";
import { oembedUrl, openUrl, type ParsedPlaylist } from "@/lib/playlists";

/**
 * A playlist's cover picture, without an API key or an account.
 *
 * Cover Flow is covers. A wall of grey rectangles with titles under them
 * is a list, and a list is what this feature already was.
 *
 * Two ways to get one, in order of how much they cost:
 *
 * Four of the six services answer oEmbed - a public endpoint that hands
 * back a thumbnail for any public playlist with no token, no quota and
 * no account. That is the whole reason this is affordable.
 *
 * Apple and Tidal have no oEmbed, so those read the og:image out of the
 * page. Every one of these services publishes one, because og:image is
 * what makes a link unfurl in a chat window, so it is about as reliable
 * as scraping ever gets. It is still scraping, so it is bounded: the
 * first 60KB of the document, which is far more than any <head>.
 *
 * Fetched once when somebody adds a playlist and stored on the row. Not
 * per render: a wall of twelve playlists would otherwise be twelve
 * requests every time anybody looked at it, and the picture does not
 * change.
 */

/** Long, because a playlist's artwork is not news. */
const COVER_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Enough for any head, small enough that a huge page cannot hurt us. */
const MAX_HTML_BYTES = 60_000;

function firstMatch(html: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

/** Only real, absolute, https image URLs. */
function usable(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!/^https:\/\/\S+$/i.test(trimmed)) return null;
  return trimmed.length > 1000 ? null : trimmed;
}

export async function fetchPlaylistCover(playlist: ParsedPlaylist): Promise<string | null> {
  const oembed = oembedUrl(playlist);
  if (oembed) {
    const res = await cachedFetch(oembed, COVER_TTL_SECONDS);
    if (res?.ok) {
      try {
        const data = (await res.json()) as { thumbnail_url?: string };
        const found = usable(data.thumbnail_url);
        if (found) return found;
      } catch {
        // Not JSON. Fall through and try the page.
      }
    }
  }

  // The page's own share image. Asked for as a browser so the service does
  // not hand back a bot page with no meta tags on it.
  const res = await cachedFetch(openUrl(playlist), COVER_TTL_SECONDS, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      accept: "text/html",
    },
  });
  if (!res?.ok) return null;

  let html: string;
  try {
    html = (await res.text()).slice(0, MAX_HTML_BYTES);
  } catch {
    return null;
  }

  return usable(
    firstMatch(html, [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    ])
  );
}
