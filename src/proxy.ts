import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rewind Theory's own domain(s), comma-separated, e.g.
// "rewindtheory.com,www.rewindtheory.com". Set in Vercel's environment
// variables. Empty means the site only lives at mythefeed.com/rewind.
const REWIND_HOSTS = (process.env.REWIND_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

// On Rewind Theory's domain the visitor sees Rewind Theory and nothing else:
// the front page is the site, its own files and routes pass through, and any
// other address on that domain goes back to the front page rather than
// showing a piece of the feed under somebody else's name.
function rewindDomain(request: NextRequest): NextResponse | null {
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  if (!REWIND_HOSTS.includes(host)) return null;

  const path = request.nextUrl.pathname;
  if (path === "/") {
    return NextResponse.rewrite(new URL("/rewind/index.html", request.url));
  }
  if (path.startsWith("/rewind/") || path.startsWith("/_next/") || path === "/favicon.ico") {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/", request.url));
}

export async function proxy(request: NextRequest) {
  const rewind = rewindDomain(request);
  if (rewind) return rewind;

  // mythefeed.com/rewind is the same site, and where an admin signs in to
  // edit it. vercel.json rewrites this too; doing it here as well means it
  // also works under `npm run dev`.
  if (request.nextUrl.pathname === "/rewind" || request.nextUrl.pathname === "/rewind/") {
    return NextResponse.rewrite(new URL("/rewind/index.html", request.url));
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the auth session cookie if it's expired.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && !request.nextUrl.pathname.startsWith("/banned")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("banned")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.banned) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/banned", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
