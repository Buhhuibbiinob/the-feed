"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The persistent list on the left, as in the iPad Messages reference:
 * a grouped table you navigate from, with the current row selected,
 * standing beside a detail pane rather than on top of it.
 *
 * This replaces navigation that lived inside the pages themselves - a
 * "More" dropdown in the bar, a Site Links panel at the foot, module
 * links scattered through the homepage. Everywhere the site can go is
 * one list now, always in the same place, always showing where you are.
 *
 * Desktop only. Below the split breakpoint the tab bar is the
 * navigation and this would just be a wall of links above the content.
 */

type Row = { href: string; label: string; badge?: number };

export function SideRail({
  username,
  isAdmin,
  notificationCount = 0,
  unreadDmCount = 0,
}: {
  username: string | null;
  isAdmin?: boolean;
  notificationCount?: number;
  unreadDmCount?: number;
}) {
  const pathname = usePathname();

  const groups: { heading: string; rows: Row[] }[] = [
    {
      heading: "Browse",
      rows: [
        { href: "/", label: "Feed" },
        { href: "/recs", label: "Discover" },
        { href: "/clubs", label: "Clubs" },
        { href: "/collections", label: "Collections" },
        { href: "/artists", label: "Creators" },
        { href: "/profiles", label: "Profiles" },
      ],
    },
    {
      heading: "Community",
      rows: [
        { href: "/leaderboard", label: "Leaderboard" },
        { href: "/chat", label: "Chat" },
        { href: "/newsletter", label: "Newsletter" },
      ],
    },
  ];

  if (username) {
    groups.push({
      heading: "You",
      rows: [
        { href: `/profile/${username}`, label: "My Profile" },
        { href: "/messages", label: "Messages", badge: unreadDmCount },
        { href: "/alerts", label: "Alerts", badge: notificationCount },
        { href: "/wrapped", label: "Wrapped" },
        { href: "/settings", label: "Settings" },
        ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
      ],
    });
  }

  // "/" would otherwise prefix-match every route on the site.
  const isCurrent = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="rail" aria-label="Sections">
      {groups.map((group) => (
        <div className="rail-group" key={group.heading}>
          <div className="rail-heading">{group.heading}</div>
          <div className="rail-rows">
            {group.rows.map((row) => {
              const current = isCurrent(row.href);
              return (
                <Link
                  key={row.href}
                  href={row.href}
                  className={`rail-row${current ? " current" : ""}`}
                  aria-current={current ? "page" : undefined}
                >
                  <span className="rail-label">{row.label}</span>
                  {!!row.badge && row.badge > 0 && <span className="rail-badge">{row.badge}</span>}
                  <span className="rail-chevron" aria-hidden="true">›</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
