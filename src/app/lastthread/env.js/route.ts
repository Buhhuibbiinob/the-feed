import { NextResponse } from "next/server";

// Hands LastThread the two public Supabase values, so nobody has to copy a
// key out of the dashboard and paste it into a file. The static site at
// /lastthread loads this as an ordinary script:
//
//   <script src="/lastthread/env.js"></script>
//
// Both values are already in this project's environment because the feed
// itself uses them, and both are meant to be public: the URL is an address,
// and the anon (now "publishable") key only does what the row level security
// policies allow. The service role key is never read here and must never be.
//
// Opened as a file:// page this route does not exist, and the site falls back
// to public/lastthread/config.js, which ships blank and means accounts are off.
export const dynamic = "force-dynamic";

export function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  // JSON.stringify so a stray quote in a value cannot break out of the string
  const body =
    "/* served from the project's environment variables */\n" +
    "window.LASTTHREAD_CONFIG = {\n" +
    `  supabaseUrl: ${JSON.stringify(url)},\n` +
    `  supabaseAnonKey: ${JSON.stringify(key)}\n` +
    "};\n";

  return new NextResponse(body, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      // short cache: changing the key in Vercel should take effect quickly
      "cache-control": "public, max-age=60",
    },
  });
}
