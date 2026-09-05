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
  { match: (p) => p.startsWith("/polls"), title: "Matchups" },
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

// The tab bar icons, drawn as one line.
//
// These were solid silhouettes, which is a tab bar from a different
// decade - the iOS 6 Clock bar this is matched to draws every glyph as a
// thin outline of a constant weight, and the difference is most of why
// the old bar read as heavy. Same stroke width, same round caps, same
// 24-unit box for all of them, so no single icon looks bolder than its
// neighbours at 25px.
const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <path d="M3.5 11.2 12 4l8.5 7.2" />
      <path d="M5.6 12.6V20h12.8v-7.4" />
      <path d="M9.9 20v-5.2h4.2V20" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <circle cx="10.8" cy="10.8" r="6.1" />
      <path d="M15.4 15.4 20 20" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <path d="M6.3 16.4V10.6a5.7 5.7 0 0 1 11.4 0v5.8l1.5 2.1H4.8z" />
      <path d="M10.2 20.6a1.9 1.9 0 0 0 3.6 0" />
    </svg>
  );
}
function CompassIcon() {
  return (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="m15.4 8.6-2 4.8-4.8 2 2-4.8z" />
    </svg>
  );
}
function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <circle cx="12" cy="8.4" r="3.7" />
      <path d="M5.4 20.2c0-3.3 2.9-5.6 6.6-5.6s6.6 2.3 6.6 5.6" />
    </svg>
  );
}
function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <circle cx="5.2" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="18.8" cy="12" r="1.5" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 8.3v7.4M8.3 12h7.4" />
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
                {!hidden.has("messages") && (
                  <IconButtonLink href="/messages" badge={unreadDmCount}>
                    Messages
                  </IconButtonLink>
                )}
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
          <span className="sk-ios-tab-icon">
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
                {!hidden.has("messages") && <Link href="/messages">Messages</Link>}
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
