// Secondary pages an admin can archive (hide from nav, block direct visits
// for non-admins). The homepage isn't included - archiving the whole feed
// doesn't make sense and page.tsx is too central to gate this way.
//
// Kept in its own module with no server imports so the header (a client
// component) can build its nav from the same list the admin screen archives.
// When these two drifted apart, the admin screen offered Archive/Unarchive
// toggles for pages the nav had already dropped, so the toggle looked broken.
export const BUILTIN_PAGES: { slug: string; label: string; path: string }[] = [
  { slug: "chat", label: "Chat", path: "/chat" },
  { slug: "leaderboard", label: "Leaderboard", path: "/leaderboard" },
  { slug: "new-releases", label: "New Releases", path: "/new-releases" },
  { slug: "recs", label: "Recs", path: "/recs" },
  { slug: "clubs", label: "Clubs", path: "/clubs" },
  { slug: "artists", label: "Creators", path: "/artists" },
  { slug: "collections", label: "Collections", path: "/collections" },
  { slug: "wrapped", label: "Wrapped", path: "/wrapped" },
  { slug: "newsletter", label: "Newsletter", path: "/newsletter" },
];

// Chat and Leaderboard get their own top-level tabs, so everything else in
// the built-in list is what the "More" menu is for.
export const TOP_LEVEL_SLUGS = new Set(["chat", "leaderboard"]);

export const MORE_PAGES = BUILTIN_PAGES.filter((p) => !TOP_LEVEL_SLUGS.has(p.slug));
