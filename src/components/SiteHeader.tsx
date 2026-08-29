"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { NotificationBell } from "@/components/NotificationBell";
import { LightDarkToggle } from "@/components/LightDarkToggle";
import { MORE_PAGES } from "@/lib/builtinPages";
import { IconButtonLink } from "@/components/IconButton";
import { AccountMenu } from "@/components/AccountMenu";
import { openComposeSheet } from "@/components/ComposeSheet";

// Built from the same list the admin Pages screen archives, so a page can
// never be missing from the nav while still offering an Archive toggle.
// New Releases is dropped from the nav: nobody used it, and it was one
// more thing competing for room in a menu the whole point of this pass is
// to shorten. The route still exists and still works if linked directly.
const RETIRED_FROM_NAV = new Set(["new-releases"]);

const MORE_LINKS = MORE_PAGES.filter((p) => !RETIRED_FROM_NAV.has(p.slug)).map((p) => ({
  href: p.path,
  label: p.label,
  slug: p.slug,
}));

const TITLES: { match: (p: string) => boolean; title: string }[] = [
  { match: (p) => p === "/", title: "Feed" },
  { match: (p) => p.startsWith("/weekly"), title: "This Week" },
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
  { match: (p) => p.startsWith("/forgot-password"), title: "Forgot Password" },
  { match: (p) => p.startsWith("/reset-password"), title: "Reset Password" },
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
function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l4.5 4.5" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a6 6 0 0 0-6 6v4l-2 3v1h16v-1l-2-3V8a6 6 0 0 0-6-6zm0 20a3 3 0 0 0 3-3H9a3 3 0 0 0 3 3z" />
    </svg>
  );
}
function CompassIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm3.7 6.3-2.1 5-5 2.1 2.1-5zM12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z" />
    </svg>
  );
}
function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4 0-7 2-7 4.5V21h14v-2.5C19 16 16 14 12 14z" />
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
function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
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
  const mobileMoreBtnRef = useRef<HTMLButtonElement>(null);
  const mobileSheetRef = useRef<HTMLDivElement>(null);

  const hidden = new Set(hiddenSlugs);
  const showDiscover = !hidden.has("recs");
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
      const target = e.target as Node;
      const insideDesktop = moreRef.current && moreRef.current.contains(target);
      const insideMobileBtn = mobileMoreBtnRef.current && mobileMoreBtnRef.current.contains(target);
      const insideMobileSheet = mobileSheetRef.current && mobileSheetRef.current.contains(target);
      if (!insideDesktop && !insideMobileBtn && !insideMobileSheet) {
        setMoreOpen(false);
      }
    }
    // click (not mousedown/touchstart) - fires only after the browser has
    // resolved the gesture, so it can't race a tap's own navigation/toggle
    // the way touchstart does (touchstart fires the instant a finger lands,
    // before the browser even knows it's a tap vs. a scroll).
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
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
        <div className="apple-nav-inner">
          <div className="brand">
            <img src="/f-logo.PNG" alt="" className="brand-logo" />
            <span className="wordmark">Feedback</span>
          </div>
          <Link href="/" className={pathname === "/" ? "active" : ""}>
            Feed
          </Link>
          {showDiscover && (
            <Link href="/recs" className={pathname.startsWith("/recs") ? "active" : ""}>
              Discover
            </Link>
          )}
          {username && (
            <Link
              href={`/profile/${username}`}
              className={pathname === `/profile/${username}` ? "active" : ""}
            >
              Profile
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
          {/* Mobile has had a prominent Post FAB in the tab bar all along;
              desktop had nothing but a card buried in the sidebar. Posting is
              the action the whole site exists for, so it gets a permanent,
              visually loud slot in the nav at every width. */}
          {username && (
            <IconButtonLink href="/post/new" primary className="nav-post-btn">
              <span className="nav-post-plus" aria-hidden="true">
                +
              </span>
              Post
            </IconButtonLink>
          )}
          <div className="nav-account">
            {theme === "ios-light" && <LightDarkToggle />}
            {username ? (
              <>
                <NotificationBell initialCount={notificationCount} />
                <IconButtonLink href="/messages" badge={unreadDmCount}>
                  Messages
                </IconButtonLink>
                {/* Admin, Settings and Sign Out used to sit out here and
                    drag the bar past its own width. They live behind the
                    account menu now - the bar keeps a fixed set of
                    actions no matter who is signed in. */}
                <AccountMenu username={username} isAdmin={isAdmin} />
              </>
            ) : (
              <>
                <IconButtonLink href="/sign-in">Sign In</IconButtonLink>
                <IconButtonLink href="/sign-up" primary>
                  Create Account
                </IconButtonLink>
              </>
            )}
          </div>
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

      {/* Five evenly spaced tabs with Post as the centre +, so every primary
          destination is one tap away and nothing depends on the browser
          back button. More moves into the Profile tab's reach rather than
          taking one of the five slots. */}
      <div className="sk-ios-tabbar">
        <Link href="/" className={`sk-ios-tab ${isHome ? "active" : ""}`}>
          <span className="sk-ios-tab-icon">
            <HomeIcon />
          </span>
          <span className="sk-ios-tab-label">Feed</span>
        </Link>
        <Link
          href="/search"
          className={`sk-ios-tab ${pathname.startsWith("/search") ? "active" : ""}`}
        >
          <span className="sk-ios-tab-icon">
            <SearchIcon />
          </span>
          <span className="sk-ios-tab-label">Search</span>
        </Link>
        <Link
          href={username ? "/post/new" : "/sign-in"}
          className="sk-ios-tab sk-ios-tab-post"
          onClick={(e) => {
            // Only signed-in members get the sheet; everyone else needs
            // the sign-in page the link already points at.
            if (username && openComposeSheet()) e.preventDefault();
          }}
        >
          <span className="sk-ios-post-fab">
            <PlusIcon />
          </span>
          <span className="sk-ios-tab-label">Post</span>
        </Link>
        {username ? (
          <Link
            href="/alerts"
            className={`sk-ios-tab ${pathname.startsWith("/alerts") ? "active" : ""}`}
          >
            <span className="sk-ios-tab-icon">
              <BellIcon />
              {notificationCount > 0 && (
                <span className="sk-ios-tab-badge">
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              )}
            </span>
            <span className="sk-ios-tab-label">Alerts</span>
          </Link>
        ) : (
          <Link
            href="/recs"
            className={`sk-ios-tab ${pathname.startsWith("/recs") ? "active" : ""}`}
          >
            <span className="sk-ios-tab-icon">
              <CompassIcon />
            </span>
            <span className="sk-ios-tab-label">Discover</span>
          </Link>
        )}
        {username ? (
          <button
            type="button"
            ref={mobileMoreBtnRef}
            className={`sk-ios-tab ${
              pathname === `/profile/${username}` || isMoreActive || moreOpen ? "active" : ""
            }`}
            onClick={() => setMoreOpen((open) => !open)}
          >
            <span className="sk-ios-tab-icon">
              <PersonIcon />
            </span>
            <span className="sk-ios-tab-label">Profile</span>
          </button>
        ) : (
          <button
            type="button"
            ref={mobileMoreBtnRef}
            className={`sk-ios-tab ${isMoreActive || moreOpen ? "active" : ""}`}
            onClick={() => setMoreOpen((open) => !open)}
          >
            <span className="sk-ios-tab-icon">
              <MoreIcon />
            </span>
            <span className="sk-ios-tab-label">More</span>
          </button>
        )}
      </div>

      {moreOpen && (
        <div className="sk-more-sheet-backdrop">
          <div className="sk-more-sheet" ref={mobileSheetRef}>
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
