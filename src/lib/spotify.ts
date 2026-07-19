import type { SupabaseClient } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/site";

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
  album: { images: { url: string; width: number; height: number }[] };
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

export type SpotifyAlbum = {
  id: string;
  name: string;
  artist: string;
  imageUrl: string | null;
  releaseDate: string;
};

type SpotifyApiAlbum = {
  id: string;
  name: string;
  artists: { name: string }[];
  images: { url: string; width: number; height: number }[];
  release_date: string;
};

function simplifyAlbum(album: SpotifyApiAlbum): SpotifyAlbum {
  return {
    id: album.id,
    name: album.name,
    artist: album.artists.map((a) => a.name).join(", "),
    imageUrl: album.images[1]?.url ?? album.images[0]?.url ?? null,
    releaseDate: album.release_date,
  };
}

// Spotify locked /v1/browse/new-releases behind "Extended Quota Mode" in
// their Nov 2024 API changes (returns 403 for standard apps), and this
// app's quota tier also strips the `popularity` field from search results
// and rejects `tag:new` combined with a `genre:` filter (both return 0
// results — confirmed via direct testing). Editorial playlists like New
// Music Friday and Release Radar are also unreachable with a plain
// client-credentials token (404s, no user session to scope them to).
//
// So instead: search *tracks* filtered by mainstream US/UK genre + the
// current year, which Spotify returns already ranked by relevance (its
// closest available proxy for popularity), then round-robin-merge the
// genre buckets so hits from every genre are spread hit-first rather than
// dumping one genre's full result set before the next.
const HIT_GENRES = ["pop", "hiphop", "r&b", "rock", "indie", "dance", "country"];
const SEARCH_PAGE_SIZE = 10;

type SpotifyApiSearchTrack = { album: SpotifyApiAlbum };

async function searchNewTracksByGenre(
  genre: string,
  accessToken: string,
  market: "US" | "GB"
): Promise<SpotifyApiAlbum[]> {
  const year = new Date().getFullYear();
  const params = new URLSearchParams({
    q: `genre:"${genre}" year:${year - 1}-${year}`,
    type: "track",
    market,
    limit: String(SEARCH_PAGE_SIZE),
  });
  const res = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { tracks: { items: SpotifyApiSearchTrack[] } };
  return data.tracks.items.map((t) => t.album);
}

export async function getNewReleases(limit = 20): Promise<SpotifyAlbum[]> {
  const accessToken = await getAppAccessToken();

  const buckets = await Promise.all(
    HIT_GENRES.flatMap((genre) =>
      (["US", "GB"] as const).map((market) => searchNewTracksByGenre(genre, accessToken, market))
    )
  );

  const seen = new Set<string>();
  const ordered: SpotifyApiAlbum[] = [];
  const maxLength = Math.max(0, ...buckets.map((b) => b.length));
  for (let i = 0; i < maxLength && ordered.length < limit; i++) {
    for (const bucket of buckets) {
      const album = bucket[i];
      if (album && album.images.length > 0 && !seen.has(album.id)) {
        seen.add(album.id);
        ordered.push(album);
      }
    }
  }

  return ordered.slice(0, limit).map(simplifyAlbum);
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
