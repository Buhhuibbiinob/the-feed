import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { WelcomeExplainer } from "@/components/WelcomeExplainer";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_THEME, isValidTheme } from "@/lib/themes";
import { isAdmin } from "@/lib/admin";
import { getNotificationCount } from "@/lib/notifications";
import { getUnreadDmCount } from "@/lib/messages";
import { getArchivedBuiltinSlugs, getActiveCustomPages } from "@/lib/pages";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const title = "Feedback";
const description = "Post reviews of music, movies, and TV - see what the community's watching and listening to.";

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
  // Lets iOS "Add to Home Screen" launch the site full-screen (no Safari
  // chrome), with its own name and app icon - the PWA / "install as app" flow.
  appleWebApp: {
    capable: true,
    title,
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  // Let the standalone app fill the notch/home-indicator safe areas.
  viewportFit: "cover",
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
  let customBackgroundUrl: string | null = null;
  let notificationCount = 0;
  let unreadDmCount = 0;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, theme, custom_background_url")
      .eq("id", user.id)
      .single();
    username = profile?.username ?? null;
    if (isValidTheme(profile?.theme)) theme = profile.theme;
    customBackgroundUrl = profile?.custom_background_url ?? null;
    admin = await isAdmin(supabase, user.id);
    notificationCount = await getNotificationCount(supabase, user.id);
    unreadDmCount = await getUnreadDmCount(supabase, user.id);
  }

  const [archivedSlugs, customPages] = await Promise.all([
    getArchivedBuiltinSlugs(supabase),
    getActiveCustomPages(supabase),
  ]);

  const htmlStyle =
    theme === "custom" && customBackgroundUrl
      ? ({ "--body-bg": `url(${customBackgroundUrl}) center / cover fixed no-repeat` } as React.CSSProperties)
      : undefined;

  return (
    <html lang="en" data-theme={theme} style={htmlStyle}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('feedback-mode')==='dark')document.documentElement.setAttribute('data-mode','dark');}catch(e){}",
          }}
        />
      </head>
      <body>
        <div className="sk-app-shell">
          <SiteHeader
            theme={theme}
            username={username}
            isAdmin={admin}
            notificationCount={notificationCount}
            unreadDmCount={unreadDmCount}
            hiddenSlugs={[...archivedSlugs]}
            customPages={customPages.map((p) => ({ href: p.path, label: p.label }))}
          />
          <div className="sk-app-content">
            <div className="wrap">{children}</div>
            <SiteFooter />
          </div>
        </div>
        <WelcomeExplainer />
      </body>
    </html>
  );
}
