import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_THEME, isValidTheme } from "@/lib/themes";
import { isAdmin } from "@/lib/admin";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const title = "the feed";
const description = "Share what you're watching, reading, and listening to.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: `%s | ${title}`,
  },
  description,
  keywords: ["music reviews", "movie reviews", "tv reviews", "social feed", "fan clubs"],
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: title,
    type: "website",
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let username: string | null = null;
  let theme = DEFAULT_THEME;
  let admin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, theme")
      .eq("id", user.id)
      .single();
    username = profile?.username ?? null;
    if (isValidTheme(profile?.theme)) theme = profile.theme;
    admin = await isAdmin(supabase, user.id);
  }

  return (
    <html lang="en" data-theme={theme}>
      <body>
        <SiteHeader username={username} isAdmin={admin} />
        <div className="wrap">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
