"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { IconButton } from "@/components/IconButton";

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13" aria-hidden="true">
      <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9 4a8.6 8.6 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a8.7 8.7 0 0 0-2-1.2L16 3H8l-.5 2.6a8.7 8.7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a8.8 8.8 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2L8 21h8l.5-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" />
    </svg>
  );
}

/**
 * Everything that used to sit loose in the nav bar - the greeting, Admin,
 * Settings, Sign Out - behind one gear button.
 *
 * Admin in particular was a top-level button that only existed for one
 * account, so the bar was a different width for the owner than for
 * everyone else and overflowed on narrower screens.
 */
export function AccountMenu({ username, isAdmin }: { username: string; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [open]);

  return (
    <div className="nav-bell" ref={ref}>
      <IconButton
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <GearIcon />
        <span className="nav-account-name">{username}</span>
      </IconButton>
      {open && (
        <div className="nav-bell-menu nav-account-menu">
          <div className="nav-bell-menu-head">Signed in as {username}</div>
          <Link href={`/profile/${username}`} className="nav-bell-row">
            Your profile
          </Link>
          <Link href="/settings" className="nav-bell-row">
            Settings
          </Link>
          {isAdmin && (
            <Link href="/admin" className="nav-bell-row">
              Admin
            </Link>
          )}
          <button type="button" className="nav-bell-row danger" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
