import type { SupabaseClient } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/site";

const API_KEY = process.env.YOUTUBE_API_KEY!;
const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID!;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET!;
const SCOPES = "https://www.googleapis.com/auth/youtube.readonly";

export function youtubeRedirectUri() {
  return `${siteUrl()}/api/youtube/callback`;
}

export function getAuthorizeUrl(state: string) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: youtubeRedirectUri(),
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

async function tokenRequest(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`YouTube token request failed: ${res.status}`);
  }
  return res.json();
}

export function exchangeCodeForTokens(code: string) {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: youtubeRedirectUri(),
    })
  );
}

export function refreshAccessToken(refreshToken: string) {
  return tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    })
  );
}

export async function getYoutubeChannel(accessToken: string): Promise<{ id: string }> {
  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=id&mine=true",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error(`YouTube channels lookup failed: ${res.status}`);
  const data = (await res.json()) as { items: { id: string }[] };
  const channel = data.items[0];
  if (!channel) throw new Error("No YouTube channel found for this account.");
  return channel;
}

export type YoutubeVideo = {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string | null;
};

type YoutubeSearchItem = {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: { medium?: { url: string }; default?: { url: string } };
  };
};

// Public search — uses a server API key, not a signed-in user's OAuth
// token, so it works for every visitor regardless of whether they've
// connected their own YouTube account.
export async function searchVideos(query: string, limit = 8): Promise<YoutubeVideo[]> {
  const params = new URLSearchParams({
    key: API_KEY,
    q: query,
    part: "snippet",
    type: "video",
    maxResults: String(limit),
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
    // Identical query returns identical results for everyone browsing the
    // same title, so cache it the same way Spotify search results are cached.
    next: { revalidate: 1800 },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { items: YoutubeSearchItem[] };
  return data.items
    .filter((item) => item.id.videoId)
    .map((item) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnailUrl: item.snippet.thumbnails.medium?.url ?? item.snippet.thumbnails.default?.url ?? null,
    }));
}

type YoutubeAccountRow = {
  access_token: string;
  refresh_token: string;
  expires_at: string;
};

export async function getValidAccessToken(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: account } = await supabase
    .from("youtube_accounts")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle<YoutubeAccountRow>();

  if (!account) return null;

  const expiresAt = new Date(account.expires_at).getTime();
  if (expiresAt - Date.now() > 60_000) {
    return account.access_token;
  }

  const refreshed = await refreshAccessToken(account.refresh_token);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  await supabase
    .from("youtube_accounts")
    .update({
      access_token: refreshed.access_token,
      expires_at: newExpiresAt,
    })
    .eq("user_id", userId);

  return refreshed.access_token;
}
