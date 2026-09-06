import type { SupabaseClient } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/site";

// No "!" here. The non-null assertion was a lie the type system
// believed: with no key set, `key=undefined` went to YouTube, YouTube
// said 400, and the code below turned that into an empty list.
const API_KEY = process.env.YOUTUBE_API_KEY ?? "";
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

// Public search - uses a server API key, not a signed-in user's OAuth
// token, so it works for every visitor regardless of whether they've
// connected their own YouTube account.
/**
 * Why a search came back with nothing.
 *
 * "No matches" and "search is broken" look identical to somebody typing
 * into a box, and for a long time they looked identical here too: every
 * failure returned an empty array. A missing API key, an exhausted daily
 * quota and a genuinely obscure song all produced the same "No matches
 * found", which is the most misleading thing a search box can say.
 */
export type SearchFailure =
  | { reason: "not-configured" }
  | { reason: "quota" }
  | { reason: "rate-limited" }
  | { reason: "http"; status: number }
  | { reason: "network" };

export type SearchResult = { videos: YoutubeVideo[]; failure?: SearchFailure };

export function describeSearchFailure(failure: SearchFailure): string {
  switch (failure.reason) {
    case "not-configured":
      return "Song search isn't set up yet: YOUTUBE_API_KEY is missing.";
    case "quota":
      return "Song search has used up today's YouTube quota. It comes back tomorrow.";
    case "rate-limited":
      // 429 is searches arriving too fast, not the daily wall - it clears
      // in seconds, so this says wait rather than come back tomorrow.
      return "Searching a bit fast for YouTube. Wait a few seconds and try again.";
    case "network":
      return "Couldn't reach YouTube. Try again in a moment.";
    default:
      return `YouTube said ${failure.status}. Try again in a moment.`;
  }
}

/** The full answer, failure included. */
export async function searchVideosDetailed(
  query: string,
  limit = 8,
  options: Parameters<typeof searchVideos>[2] = {}
): Promise<SearchResult> {
  if (!API_KEY) return { videos: [], failure: { reason: "not-configured" } };

  const params = new URLSearchParams({
    key: API_KEY,
    q: query,
    part: "snippet",
    type: "video",
    maxResults: String(limit),
    ...(options.publishedAfter ? { publishedAfter: options.publishedAfter } : {}),
    ...(options.publishedBefore ? { publishedBefore: options.publishedBefore } : {}),
    ...(options.order ? { order: options.order } : {}),
  });

  let res: Response;
  try {
    res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
      next: { revalidate: options.revalidateSeconds ?? 1800 },
    });
  } catch {
    return { videos: [], failure: { reason: "network" } };
  }

  if (!res.ok) {
    // 403 is what an exhausted quota looks like, and it is by far the
    // likeliest failure on a key that used to work.
    if (res.status === 403) return { videos: [], failure: { reason: "quota" } };
    if (res.status === 429) return { videos: [], failure: { reason: "rate-limited" } };
    return { videos: [], failure: { reason: "http", status: res.status } };
  }

  const data = (await res.json()) as { items: YoutubeSearchItem[] };
  return {
    videos: data.items
      .filter((item) => item.id.videoId)
      .map((item) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        thumbnailUrl:
          item.snippet.thumbnails.medium?.url ?? item.snippet.thumbnails.default?.url ?? null,
      })),
  };
}

/**
 * Videos only, for the callers that run on a schedule and have nobody to
 * tell. The search box uses searchVideosDetailed instead.
 */
export async function searchVideos(
  query: string,
  limit = 8,
  options: {
    publishedAfter?: string;
    publishedBefore?: string;
    order?: string;
    // Each search costs 100 units of a 10k/day quota, so callers that run
    // on every page render (rather than on a user's keystroke) can hold
    // their results for longer than the default half hour.
    revalidateSeconds?: number;
  } = {}
): Promise<YoutubeVideo[]> {
  return (await searchVideosDetailed(query, limit, options)).videos;
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
