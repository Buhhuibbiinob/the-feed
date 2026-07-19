import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, getYoutubeChannel } from "@/lib/youtube";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const cookieState = request.cookies.get("youtube_oauth_state")?.value;

  const settingsUrl = new URL("/settings", request.url);

  if (oauthError || !code || !state || !cookieState || state !== cookieState) {
    settingsUrl.searchParams.set("youtube_error", "1");
    const response = NextResponse.redirect(settingsUrl);
    response.cookies.delete("youtube_oauth_state");
    return response;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const channel = await getYoutubeChannel(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await supabase.from("youtube_accounts").upsert({
      user_id: user.id,
      youtube_channel_id: channel.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? "",
      expires_at: expiresAt,
    });
  } catch {
    settingsUrl.searchParams.set("youtube_error", "1");
  }

  const response = NextResponse.redirect(settingsUrl);
  response.cookies.delete("youtube_oauth_state");
  return response;
}
