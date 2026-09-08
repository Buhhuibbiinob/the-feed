import type { SupabaseClient } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/site";
import { cachedFetch } from "@/lib/cachedFetch";

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
const SCOPES = "user-top-read user-read-recently-played";

export function spotifyRedirectUri() {
  return `${siteUrl()}/api/spotify/callback`;
}

export function getAuthorizeUrl(state: string) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: spotifyRedirectUri(),
    scope: SCOPES,
    state,
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

async function tokenRequest(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`Spotify token request failed: ${res.status}`);
  }
  return res.json();
}

export function exchangeCodeForTokens(code: string) {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: spotifyRedirectUri(),
    })
  );
}

export function refreshAccessToken(refreshToken: string) {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    })
  );
}

export async function getSpotifyProfile(accessToken: string): Promise<{ id: string }> {
  const res = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Spotify /me failed: ${res.status}`);
  return res.json();
}

export type SpotifyTrack = {
  id: string;
  name: string;
  artist: string;
  imageUrl: string | null;
};

type SpotifyApiTrack = {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    images: { url: string; width: number; height: number }[];
    /**
     * When the ALBUM this copy sits on came out - "1994", "1994-09" or
     * "1994-09-13" depending on how precisely Spotify knows it.
     *
     * The reason this file now matters to the shelves. Apple is the only
     * other source with a year, and Apple is the one that throttles, so
     * a record rescued from Deezer had no year at all - which meant a
     * shelf headed 1994 could not check whether it was looking at a 1994
     * record. Unknown has to be allowed to stay (see shelfSpan), so an
     * unknown year is a record that cannot be put in the wrong place OR
     * kept out of it.
     */
    release_date?: string;
  };
  external_urls?: { spotify?: string };
};

function simplifyTrack(track: SpotifyApiTrack): SpotifyTrack {
  return {
    id: track.id,
    name: track.name,
    artist: track.artists.map((a) => a.name).join(", "),
    imageUrl: track.album.images[1]?.url ?? track.album.images[0]?.url ?? null,
  };
}

export async function getTopTracks(accessToken: string, limit = 10): Promise<SpotifyTrack[]> {
  const res = await fetch(
    `https://api.spotify.com/v1/me/top/tracks?limit=${limit}&time_range=short_term`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { items: SpotifyApiTrack[] };
  return data.items.map(simplifyTrack);
}

// Cached in module scope so repeated server-side renders in the same
// process reuse one app-level token instead of hitting the token endpoint
// on every request (this token isn't tied to any user).
let cachedAppToken: { token: string; expiresAt: number } | null = null;

export async function getAppAccessToken(): Promise<string> {
  if (cachedAppToken && cachedAppToken.expiresAt - Date.now() > 60_000) {
    return cachedAppToken.token;
  }
  const { access_token, expires_in } = await tokenRequest(
    new URLSearchParams({ grant_type: "client_credentials" })
  );
  cachedAppToken = { token: access_token, expiresAt: Date.now() + expires_in * 1000 };
  return access_token;
}

export async function searchTracks(
  accessToken: string,
  query: string,
  limit = 8
): Promise<SpotifyTrack[]> {
  const params = new URLSearchParams({ q: query, type: "track", limit: String(limit) });
  const res = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { tracks: { items: SpotifyApiTrack[] } };
  return data.tracks.items.map(simplifyTrack);
}

type SpotifyAccountRow = {
  access_token: string;
  refresh_token: string;
  expires_at: string;
};

export async function getValidAccessToken(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: account } = await supabase
    .from("spotify_accounts")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle<SpotifyAccountRow>();

  if (!account) return null;

  const expiresAt = new Date(account.expires_at).getTime();
  if (expiresAt - Date.now() > 60_000) {
    return account.access_token;
  }

  const refreshed = await refreshAccessToken(account.refresh_token);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  await supabase
    .from("spotify_accounts")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? account.refresh_token,
      expires_at: newExpiresAt,
    })
    .eq("user_id", userId);

  return refreshed.access_token;
}


// ---------------------------------------------------------------------
// The catalogue side of Spotify.
//
// Everything above is about a member connecting their own account. This
// is the app's own token asking about a record nobody has connected
// anything for, which is what the shelves need.
//
// What Spotify is good for here is precisely one thing the other two are
// not: the release year. Apple has years but throttles at twenty calls a
// minute; Deezer has headroom but its search carries no date. So a
// record that came from Deezer had no year, and a shelf headed 1994
// could not tell whether it was holding a 1994 record.
//
// What it is NOT used for is previews. Spotify stopped serving
// preview_url to newly registered apps, so treating it as a clip source
// would mean a play button that works or does not depending on when the
// app was registered - which is the worst kind of feature.

function yearFrom(releaseDate: string | undefined): number | null {
  if (!releaseDate) return null;
  const year = Number(releaseDate.slice(0, 4));
  return Number.isFinite(year) && year >= 1900 ? year : null;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stripParens(s: string): string {
  return s.replace(/[([].*?[)\]]/g, "").trim();
}

/**
 * The same strictness the other two catalogues use.
 *
 * A search is a relevance search. Asking for an obscure track by a
 * well-known artist gets that artist's hits back, and a record wearing
 * somebody else's sleeve and somebody else's year is worse than a record
 * with neither.
 */
export function matchSpotifyTrack(
  items: SpotifyApiTrack[],
  trackName: string,
  artistName: string
): SpotifyApiTrack | undefined {
  const wantTrack = normalize(trackName);
  const wantArtist = normalize(artistName);
  return items.find((item) => {
    const gotArtist = normalize(item.artists.map((a) => a.name).join(" "));
    if (!gotArtist) return false;
    const artistMatches = gotArtist.includes(wantArtist) || wantArtist.includes(gotArtist);
    if (!artistMatches) return false;
    const gotTrack = normalize(item.name);
    const gotCore = normalize(stripParens(item.name));
    return (
      gotTrack === wantTrack ||
      gotTrack.startsWith(wantTrack) ||
      wantTrack.startsWith(gotTrack) ||
      (gotCore.length > 0 && (gotCore === wantTrack || wantTrack.startsWith(gotCore)))
    );
  });
}

export type SpotifyLookup = {
  artworkUrl: string | null;
  trackUrl: string | null;
  year: number | null;
};

const NOTHING: SpotifyLookup = { artworkUrl: null, trackUrl: null, year: null };

/**
 * Artwork and, mainly, a year for one record.
 *
 * Returns nothing at all rather than throwing when the app is not
 * configured, so a site with no Spotify credentials behaves exactly as
 * it did before this existed.
 *
 * The EARLIEST matching release is taken, not the first result, for the
 * same reason Apple's lookup does it: a search returns the anniversary
 * edition as readily as the original, and a shelf that trusted the top
 * hit would throw "Heart of Glass" off its own decade for being a 2014
 * remaster.
 */
export async function lookupSpotifyTrack(
  trackName: string,
  artistName: string
): Promise<SpotifyLookup> {
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) return NOTHING;
  try {
    const token = await getAppAccessToken();
    const params = new URLSearchParams({
      q: `track:${trackName} artist:${artistName}`,
      type: "track",
      limit: "10",
    });
    // Through cachedFetch, like every other outward call here. Written
    // with a bare fetch and `next: { revalidate }` first, which sets a
    // lifetime WITHOUT opting into the cache - so it would have been a
    // live Spotify request on every render of every year shelf. The
    // cache check caught it, which is exactly what that check exists
    // for: this failure is invisible and just quietly costs.
    //
    // A year does not change, so it is held for a day.
    const res = await cachedFetch(`https://api.spotify.com/v1/search?${params.toString()}`, 86400, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res || !res.ok) return NOTHING;
    const data = (await res.json()) as { tracks?: { items?: SpotifyApiTrack[] } };
    const items = data.tracks?.items ?? [];
    const matches = items.filter((item) => matchSpotifyTrack([item], trackName, artistName));
    if (matches.length === 0) return NOTHING;

    let best: number | null = null;
    for (const item of matches) {
      const year = yearFrom(item.album.release_date);
      if (year !== null && (best === null || year < best)) best = year;
    }
    const first = matches[0];
    return {
      artworkUrl: first.album.images[0]?.url ?? null,
      trackUrl: first.external_urls?.spotify ?? null,
      year: best,
    };
  } catch {
    return NOTHING;
  }
}
