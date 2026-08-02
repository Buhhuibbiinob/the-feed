"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { NotificationBell } from "@/components/NotificationBell";
import { LightDarkToggle } from "@/components/LightDarkToggle";

const MORE_LINKS = [
  { href: "/new-releases", label: "New Releases", slug: "new-releases" },
  { href: "/recs", label: "Recs", slug: "recs" },
  { href: "/clubs", label: "Clubs", slug: "clubs" },
  { href: "/artists", label: "Creators", slug: "artists" },
  { href: "/collections", label: "Collections", slug: "collections" },
  { href: "/wrapped", label: "Wrapped", slug: "wrapped" },
  { href: "/newsletter", label: "Newsletter", slug: "newsletter" },
];

const TITLES: { match: (p: string) => boolean; title: string }[] = [
  { match: (p) => p === "/", title: "Feed" },
  { match: (p) => p.startsWith("/chat"), title: "Chat" },
  { match: (p) => p.startsWith("/leaderboard"), title: "Leaderboard" },
  { match: (p) => p.startsWith("/search"), title: "Search" },
  { match: (p) => p.startsWith("/messages"), title: "Messages" },
  { match: (p) => p.startsWith("/settings"), title: "Settings" },
  { match: (p) => p.startsWith("/admin"), title: "Admin" },
  { match: (p) => p.startsWith("/profile"), title: "Profile" },
  { match: (p) => p.startsWith("/post/new"), title: "New Post" },
  { match: (p) => p.startsWith("/post"), title: "Review" },
  { match: (p) => p.startsWith("/sign-in"), title: "Sign In" },
  { match: (p) => p.startsWith("/sign-up"), title: "Create Account" },
];

function titleFor(pathname: string): string {
  return TITLES.find((t) => t.match(pathname))?.title ?? "Feedback";
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z" />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 4h16v12H7l-3 3z" />
    </svg>
  );
}
function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 3h12v3h3v2c0 2.5-2 4.5-4.3 4.9A5 5 0 0 1 13 16.9V19h3v2H8v-2h3v-2.1a5 5 0 0 1-3.7-4A5.3 5.3 0 0 1 3 8V6h3zM5 6v2c0 1.3.8 2.4 2 2.8A9 9 0 0 1 6 8V6zm14 0h-1v2a9 9 0 0 1-1 2.8c1.2-.4 2-1.5 2-2.8z" />
    </svg>
  );
}
function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

export function SiteHeader({
  theme,
  username,
  isAdmin = false,
  notificationCount = 0,
  unreadDmCount = 0,
  hiddenSlugs = [],
  customPages = [],
}: {
  theme: string;
  username: string | null;
  isAdmin?: boolean;
  notificationCount?: number;
  unreadDmCount?: number;
  hiddenSlugs?: string[];
  customPages?: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const hidden = new Set(hiddenSlugs);
  const showChat = !hidden.has("chat");
  const showLeaderboard = !hidden.has("leaderboard");
  const visibleMoreLinks = [
    ...MORE_LINKS.filter((link) => !hidden.has(link.slug)),
    ...customPages,
  ];

  const isMoreActive = visibleMoreLinks.some(
    (link) => pathname === link.href || pathname.startsWith(`${link.href}/`)
  );

  useEffect(() => {
    if (!moreOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [moreOpen]);

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (moreOpen) setMoreOpen(false);
  }

  const isHome = pathname === "/";

  return (
    <>
      <div className="apple-nav">
        <div className="brand">
          <img src="/f-logo.PNG" alt="" className="brand-logo" />
          <span className="wordmark">Feedback</span>
        </div>
        <Link href="/" className={pathname === "/" ? "active" : ""}>
          Feed
        </Link>
        {showChat && (
          <Link href="/chat" className={pathname === "/chat" ? "active" : ""}>
            Chat
          </Link>
        )}
        {showLeaderboard && (
          <Link href="/leaderboard" className={pathname === "/leaderboard" ? "active" : ""}>
            Leaderboard
          </Link>
        )}
        <div className="nav-more" ref={moreRef}>
          <button
            type="button"
            className={`nav-more-btn ${isMoreActive ? "active" : ""}`}
            onClick={() => setMoreOpen((open) => !open)}
            aria-haspopup="true"
            aria-expanded={moreOpen}
          >
            More <span className="nav-more-caret">▾</span>
          </button>
          {moreOpen && (
            <div className="nav-more-menu">
              {visibleMoreLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={pathname === link.href || pathname.startsWith(`${link.href}/`) ? "active" : ""}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </div>
        <form action="/search" method="get" className="nav-search">
          <input type="search" name="q" placeholder="Search Feedback" aria-label="Search" />
        </form>
        <div className="nav-account">
          {theme === "ios-light" && <LightDarkToggle />}
          {username ? (
            <>
              <NotificationBell initialCount={notificationCount} />
              <Link href="/messages" className="nav-bell-btn">
                Messages
                {unreadDmCount > 0 && (
                  <span className="nav-bell-badge">{unreadDmCount > 9 ? "9+" : unreadDmCount}</span>
                )}
              </Link>
              <Link href={`/profile/${username}`} className="nav-user">
                Hi, {username}
              </Link>
              {isAdmin && (
                <Link href="/admin" className="acct-btn">
                  <span>Admin</span>
                </Link>
              )}
              <Link href="/settings" className="acct-btn">
                <span>Settings</span>
              </Link>
              <button className="acct-btn primary" onClick={() => signOut()}>
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <>
              <Link href="/sign-in" className="acct-btn sk-btn-secondary">
                <span>Sign In</span>
              </Link>
              <Link href="/sign-up" className="acct-btn primary sk-btn">
                <span>Create Account</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ---- iOS app-shell chrome: default-theme-only, hidden elsewhere ---- */}
      <div className="sk-ios-topbar">
        {!isHome ? (
          <button type="button" className="sk-ios-back" onClick={() => window.history.back()}>
            Back
          </button>
        ) : (
          <span />
        )}
        <span className="sk-ios-title">{titleFor(pathname)}</span>
        {username ? (
          <Link href="/post/new" className="sk-ios-action">
            + Post
          </Link>
        ) : (
          <Link href="/sign-in" className="sk-ios-action">
            Sign In
          </Link>
        )}
      </div>

      <div className="sk-ios-tabbar">
        <Link href="/" className={`sk-ios-tab ${isHome ? "active" : ""}`}>
          <span className="sk-ios-tab-icon">
            <HomeIcon />
          </span>
          <span className="sk-ios-tab-label">Feed</span>
        </Link>
        {showChat && (
          <Link href="/chat" className={`sk-ios-tab ${pathname.startsWith("/chat") ? "active" : ""}`}>
            <span className="sk-ios-tab-icon">
              <ChatIcon />
            </span>
            <span className="sk-ios-tab-label">Chat</span>
          </Link>
        )}
        {showLeaderboard && (
          <Link
            href="/leaderboard"
            className={`sk-ios-tab ${pathname.startsWith("/leaderboard") ? "active" : ""}`}
          >
            <span className="sk-ios-tab-icon">
              <TrophyIcon />
            </span>
            <span className="sk-ios-tab-label">Leaderboard</span>
          </Link>
        )}
        <button
          type="button"
          className={`sk-ios-tab ${isMoreActive || moreOpen ? "active" : ""}`}
          onClick={() => setMoreOpen((open) => !open)}
        >
          <span className="sk-ios-tab-icon">
            <MoreIcon />
          </span>
          <span className="sk-ios-tab-label">More</span>
        </button>
      </div>

      {moreOpen && (
        <div className="sk-more-sheet-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="sk-more-sheet" onClick={(e) => e.stopPropagation()}>
            <form action="/search" method="get" className="nav-search sk-more-sheet-search">
              <input type="search" name="q" placeholder="Search Feedback" aria-label="Search" />
            </form>
            {visibleMoreLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
            <div className="sk-more-sheet-divider" />
            {username ? (
              <>
                <Link href={`/profile/${username}`}>Profile</Link>
                <Link href="/messages">Messages</Link>
                {isAdmin && <Link href="/admin">Admin</Link>}
                <Link href="/settings">Settings</Link>
                <button type="button" onClick={() => signOut()}>
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/sign-in">Sign In</Link>
                <Link href="/sign-up">Create Account</Link>
              </>
            )}
            {theme === "ios-light" && (
              <>
                <div className="sk-more-sheet-divider" />
                <div className="sk-more-sheet-toggle-row">
                  <LightDarkToggle />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
