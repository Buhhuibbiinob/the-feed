"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RailIcon } from "@/components/RailIcon";

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

type Row = { href: string; label: string; icon: string; badge?: number };

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
        { href: "/", label: "Feed", icon: "feed" },
        { href: "/recs", label: "Discover", icon: "discover" },
        { href: "/clubs", label: "Clubs", icon: "clubs" },
        { href: "/collections", label: "Collections", icon: "collections" },
        { href: "/artists", label: "Creators", icon: "creators" },
        { href: "/profiles", label: "Profiles", icon: "profiles" },
      ],
    },
    {
      heading: "Community",
      rows: [
        // First in the group on purpose: it is the only thing here that
        // changes on its own every week, so it is the one worth checking.
        { href: "/weekly", label: "This Week", icon: "weekly" },
        { href: "/leaderboard", label: "Leaderboard", icon: "leaderboard" },
        { href: "/chat", label: "Chat", icon: "chat" },
        { href: "/newsletter", label: "Newsletter", icon: "newsletter" },
      ],
    },
  ];

  if (username) {
    groups.push({
      heading: "You",
      rows: [
        { href: `/profile/${username}`, label: "My Profile", icon: "profile" },
        { href: "/messages", label: "Messages", icon: "messages", badge: unreadDmCount },
        { href: "/alerts", label: "Alerts", icon: "alerts", badge: notificationCount },
        { href: "/wrapped", label: "Wrapped", icon: "wrapped" },
        { href: "/settings", label: "Settings", icon: "settings" },
        ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: "admin" }] : []),
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
                  <RailIcon name={row.icon} />
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
