"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { NotificationBell } from "@/components/NotificationBell";

const MORE_LINKS = [
  { href: "/new-releases", label: "New Releases", slug: "new-releases" },
  { href: "/recs", label: "Recs", slug: "recs" },
  { href: "/clubs", label: "Clubs", slug: "clubs" },
  { href: "/artists", label: "Creators", slug: "artists" },
  { href: "/collections", label: "Collections", slug: "collections" },
  { href: "/wrapped", label: "Wrapped", slug: "wrapped" },
  { href: "/newsletter", label: "Newsletter", slug: "newsletter" },
];

export function SiteHeader({
  username,
  isAdmin = false,
  notificationCount = 0,
  unreadDmCount = 0,
  hiddenSlugs = [],
  customPages = [],
}: {
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

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  return (
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
                onClick={() => setMoreOpen(false)}
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
            <Link href="/sign-in" className="acct-btn">
              <span>Sign In</span>
            </Link>
            <Link href="/sign-up" className="acct-btn primary">
              <span>Create Account</span>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
