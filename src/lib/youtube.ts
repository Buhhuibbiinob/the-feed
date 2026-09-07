import { cachedFetch } from "@/lib/cachedFetch";
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
  /** The key is set and Google will not accept it. */
  | { reason: "key-rejected"; detail: string }
  | { reason: "http"; status: number }
  | { reason: "network" };

export type SearchResult = { videos: YoutubeVideo[]; failure?: SearchFailure };

export function describeSearchFailure(failure: SearchFailure): string {
  switch (failure.reason) {
    case "not-configured":
      return "This needs a YouTube key before it can show anything.";
    case "quota":
      return "Today's YouTube quota is used up. It comes back at midnight Pacific.";
    case "rate-limited":
      return "Searching a bit fast for YouTube. Wait a few seconds and try again.";
    case "key-rejected":
      // Said plainly, because this is the one failure here that nobody
      // can wait out. It looked exactly like a spent quota for as long
      // as the status code was all we read, so it was advice to come
      // back tomorrow for a problem that would still be there tomorrow.
      return `YouTube is refusing the API key (${failure.detail}). That needs fixing in the Google Cloud console, not waiting out.`;
    case "network":
      return "Couldn't reach YouTube. Try again in a moment.";
    default:
      return `YouTube said ${failure.status}. Try again in a moment.`;
  }
}

/**
 * What Google actually said, rather than what the status code implies.
 *
 * The status code alone is not enough to tell these apart, and getting
 * it wrong sends somebody to wait for a thing that will never happen.
 * A spent daily quota comes back as 403 quotaExceeded on one path and
 * 429 RESOURCE_EXHAUSTED on another; a key with an HTTP-referrer
 * restriction on it - which is the default when you create one in the
 * console and is useless from a server - comes back as 403 too, and so
 * does a key from the wrong project, and so does one with the YouTube
 * Data API not switched on.
 *
 * Reading 403 as "quota" meant every one of those said "used up, comes
 * back tomorrow", and tomorrow it said it again. The body names the
 * reason, so it is read.
 */
export function failureFromBody(status: number, body: string): SearchFailure {
  let reason = "";
  let message = "";
  try {
    const parsed = JSON.parse(body) as {
      error?: { errors?: { reason?: string; message?: string }[]; status?: string; message?: string };
    };
    reason = parsed.error?.errors?.[0]?.reason ?? parsed.error?.status ?? "";
    message = parsed.error?.errors?.[0]?.message ?? parsed.error?.message ?? "";
  } catch {
    // Not JSON. Fall through to the status code, which is all there is.
  }

  const r = reason.toLowerCase();
  if (r.includes("quotaexceeded") || r.includes("dailylimitexceeded") || r === "resource_exhausted") {
    return { reason: "quota" };
  }
  if (r.includes("ratelimitexceeded")) return { reason: "rate-limited" };
  if (
    r.includes("keyinvalid") ||
    r.includes("keyexpired") ||
    r.includes("iprefererblocked") ||
    r.includes("forbidden") ||
    r.includes("accessnotconfigured") ||
    r.includes("permission_denied") ||
    r.includes("unauthenticated")
  ) {
    return { reason: "key-rejected", detail: reason || message || `HTTP ${status}` };
  }

  // Nothing recognised in the body. The status code is the last word,
  // and this is where the old guesses live - but now only as a
  // fallback, with whatever Google said carried along so it is
  // diagnosable rather than a shrug.
  if (status === 429) return { reason: "quota" };
  if (status === 403) {
    return reason || message
      ? { reason: "key-rejected", detail: reason || message }
      : { reason: "quota" };
  }
  return { reason: "http", status };
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

  // Actually cached. This read `next: { revalidate }` alone, which sets a
  // lifetime and does not opt in, so every page view was a live search
  // at a hundred units of a ten thousand a day quota - which is what the
  // rate limit on the rails was.
  const res = await cachedFetch(
    `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
    options.revalidateSeconds ?? 1800
  );
  if (!res) return { videos: [], failure: { reason: "network" } };

  if (!res.ok) {
    // Read what Google said, not just the number it said it with.
    const body = await res.text().catch(() => "");
    const failure = failureFromBody(res.status, body);
    // Logged once per failed search, because this is the one thing here
    // that cannot be worked out from the outside: the page can only ever
    // show a sentence, and the reason string is what actually says
    // whether to wait, to top up, or to go and fix the key.
    console.error(`[youtube] ${res.status} ${failure.reason}: ${body.slice(0, 300)}`);
    return { videos: [], failure };
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
