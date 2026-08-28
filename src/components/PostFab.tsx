"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { openComposeSheet } from "@/components/ComposeSheet";

// A floating Post button, so posting is reachable from anywhere rather
// than only from the top of the page.
//
// Hidden on the pages where it would be in the way or absurd: the composer
// itself, and auth screens. On mobile the tab bar already carries a centre
// + button, so this is desktop-only in CSS to avoid two Post buttons
// stacked in the same corner.
const HIDDEN_ON = ["/post/new", "/sign-in", "/sign-up", "/forgot-password", "/reset-password"];

export function PostFab({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();

  if (!signedIn) return null;
  if (HIDDEN_ON.some((path) => pathname.startsWith(path))) return null;

  return (
    <Link
      href="/post/new"
      className="post-fab"
      aria-label="Post a review"
      onClick={(e) => {
        // Still a real link to a real page. This only takes over once
        // the sheet has mounted, so no-JS and pre-hydration clicks
        // navigate exactly as before.
        if (openComposeSheet()) e.preventDefault();
      }}
    >
      <span className="post-fab-plus" aria-hidden="true">
        +
      </span>
      <span className="post-fab-label">Post</span>
    </Link>
  );
}
