import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Handles every "click the link in your email" landing:
//  - token_hash + type  -> what our own signup email sends. verifyOtp
//    confirms the address AND writes the session cookies, so the user lands
//    already signed in instead of being bounced to a login form.
//  - code               -> PKCE flow (password reset, magic link), where
//    Supabase's own email redirects here after its verify endpoint.
// Anything else means the link was malformed, already used, or expired.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      // Nav links prefetched while signed out are still in the client router
      // cache - invalidate the layout so the header renders as signed in.
      revalidatePath("/", "layout");
      const defaultTarget =
        type === "recovery" ? "/reset-password" : type === "signup" ? "/?verified=true" : "/";
      return NextResponse.redirect(`${origin}${next ?? defaultTarget}`);
    }
    console.error(`[auth/callback] verifyOtp failed (type=${type}): ${error.message}`);
    return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      revalidatePath("/", "layout");
      return NextResponse.redirect(`${origin}${next ?? "/?verified=true"}`);
    }
    console.error(`[auth/callback] exchangeCodeForSession failed: ${error.message}`);
    return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(
    `${origin}/sign-in?error=${encodeURIComponent("That confirmation link is invalid or has already been used.")}`
  );
}
