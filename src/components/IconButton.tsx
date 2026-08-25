"use client";

import Link from "next/link";

// One size for every action in the nav bar. +Post, Alerts and Messages
// were each styled by their own rule and rendered at visibly different
// heights; this is the single place that decides how a nav action looks.
//
// Comes in a link and a button flavour because the nav needs both (Post is
// navigation, Sign Out is an action) and they must look identical.

type CommonProps = {
  children: React.ReactNode;
  /** A count rendered as the red corner badge. Zero or absent shows none. */
  badge?: number;
  primary?: boolean;
  className?: string;
  "aria-label"?: string;
};

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span className="nav-bell-badge">{count > 9 ? "9+" : count}</span>;
}

export function IconButtonLink({
  href,
  children,
  badge = 0,
  primary = false,
  className = "",
  ...rest
}: CommonProps & { href: string }) {
  return (
    <Link href={href} className={`nav-icon-btn${primary ? " primary" : ""} ${className}`.trim()} {...rest}>
      {children}
      <Badge count={badge} />
    </Link>
  );
}

export function IconButton({
  onClick,
  children,
  badge = 0,
  primary = false,
  className = "",
  type = "button",
  ...rest
}: CommonProps & {
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`nav-icon-btn${primary ? " primary" : ""} ${className}`.trim()}
      {...rest}
    >
      {children}
      <Badge count={badge} />
    </button>
  );
}
