import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_THEME, isValidTheme } from "@/lib/themes";
import { isAdmin } from "@/lib/admin";

export const metadata: Metadata = {
  title: "the feed",
  description: "Share what you're watching, reading, and listening to.",
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
