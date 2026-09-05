// Secondary pages an admin can archive (hide from nav, block direct visits
// for non-admins). The homepage isn't included - archiving the whole feed
// doesn't make sense and page.tsx is too central to gate this way.
//
// Kept in its own module with no server imports so the header (a client
// component) can build its nav from the same list the admin screen archives.
// When these two drifted apart, the admin screen offered Archive/Unarchive
// toggles for pages the nav had already dropped, so the toggle looked broken.
export const BUILTIN_PAGES: { slug: string; label: string; path: string }[] = [
  { slug: "weekly", label: "This Week", path: "/weekly" },
  { slug: "polls", label: "Matchups", path: "/polls" },
  { slug: "chat", label: "Chat", path: "/chat" },
  { slug: "leaderboard", label: "Leaderboard", path: "/leaderboard" },
  { slug: "new-releases", label: "New Releases", path: "/new-releases" },
  { slug: "recs", label: "Discover", path: "/recs" },
  { slug: "profiles", label: "Profiles", path: "/profiles" },
  { slug: "clubs", label: "Clubs", path: "/clubs" },
  { slug: "artists", label: "Creators", path: "/artists" },
  { slug: "collections", label: "Collections", path: "/collections" },
  { slug: "queue", label: "Up Next", path: "/queue" },
  { slug: "wrapped", label: "Wrapped", path: "/wrapped" },
  { slug: "newsletter", label: "Newsletter", path: "/newsletter" },
  { slug: "messages", label: "Messages", path: "/messages" },
];

// Pages that are OFF unless somebody has turned them on, rather than on
// unless somebody has turned them off.
//
// Direct messages are here because they were switched off deliberately:
// a private inbox on a site with thirteen people is a place for things
// to happen that nobody else can see, and it is the one part of a small
// community that cannot be moderated by being read. Nothing is deleted -
// every message is still in the database, and one toggle in
// Admin -> Pages brings the whole thing back exactly as it was.
//
// The mechanism is general: anything listed here needs a site_pages row
// saying archived=false before it appears.
export const DEFAULT_ARCHIVED_SLUGS = new Set(["messages"]);

// The top level is Feed, Discover and Profile - the three things the site
// is actually for. Chat and Leaderboard used to sit up here too, which
// spread attention across five destinations and made none of them feel
// like the main one; they're a tap further away now, in "More", along with
// everything else.
//
// Discover points at /recs because that page already is discovery (For You
// plus Trending). Promoting it beat adding a new hub page for the sake of
// having something called "Discover".
export const TOP_LEVEL_SLUGS = new Set(["recs"]);

export const MORE_PAGES = BUILTIN_PAGES.filter((p) => !TOP_LEVEL_SLUGS.has(p.slug));
