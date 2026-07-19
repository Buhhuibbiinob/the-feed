"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";

export function SiteHeader({ username, isAdmin = false }: { username: string | null; isAdmin?: boolean }) {
  const pathname = usePathname();

  return (
    <>
      <div className="apple-nav">
        <div className="brand">
          <div className="orb" />
          <span className="wordmark">the feed</span>
        </div>
        <a href="#" className="disabled">
          Store
        </a>
        <Link href="/" className={pathname === "/" ? "active" : ""}>
          Feed
        </Link>
        <Link href="/new-releases" className={pathname === "/new-releases" ? "active" : ""}>
          New Releases
        </Link>
        <Link href="/chat" className={pathname === "/chat" ? "active" : ""}>
          Chat
        </Link>
        <Link href="/leaderboard" className={pathname === "/leaderboard" ? "active" : ""}>
          Leaderboard
        </Link>
        <Link href="/recs" className={pathname === "/recs" ? "active" : ""}>
          Recs
        </Link>
        <Link href="/wrapped" className={pathname === "/wrapped" ? "active" : ""}>
          Wrapped
        </Link>
        <Link href="/clubs" className={pathname.startsWith("/clubs") ? "active" : ""}>
          Clubs
        </Link>
        <Link href="/collections" className={pathname.startsWith("/collections") ? "active" : ""}>
          Collections
        </Link>
        <div className="nav-account">
          {username ? (
            <>
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
      <div className="apple-subnav">
        <Link href="/new-releases" className={pathname === "/new-releases" ? "active" : ""}>
          New Releases
        </Link>
        <Link href="/" className={pathname === "/" ? "active" : ""}>
          This Week
        </Link>
        <Link href="/chat" className={pathname === "/chat" ? "active" : ""}>
          Live Chat
        </Link>
        <Link href="/recs" className={pathname === "/recs" ? "active" : ""}>
          Recs
        </Link>
        <Link href="/wrapped" className={pathname === "/wrapped" ? "active" : ""}>
          Wrapped
        </Link>
      </div>
    </>
  );
}
