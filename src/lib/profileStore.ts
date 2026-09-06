// Turning one member's reviews into a music store.
//
// The reference is the 2003 iTunes Music Store front page: a row of three
// featured banners, shelves of cover art with arrows and "See All", a row
// of wide promo tiles, and a numbered chart down the right. Every one of
// those slots wants different content, and all of it has to come from
// what this person has actually posted - a store with empty shelves is
// worse than no store.
//
// So the picking rules live here, as pure functions over the rows the
// profile page already loads. They decide what is featured, what is on
// each shelf, and what charts, and they are pinned by check:store.

export type StorePost = {
  id: string;
  title: string;
  artist: string | null;
  cover_url: string | null;
  rating: number | null;
  created_at: string;
  genre?: string | null;
  media_type?: string | null;
};

export type StoreItem = {
  id: string;
  title: string;
  subtitle: string;
  coverUrl: string | null;
  href: string;
};

export const HERO_SLOTS = 3;
export const SHELF_SLOTS = 4;
export const CHART_ROWS = 10;
export const FEATURED_ARTISTS = 8;

function toItem(p: StorePost): StoreItem {
  return {
    id: p.id,
    title: p.title,
    subtitle: p.artist ?? "",
    coverUrl: p.cover_url,
    href: `/post/${p.id}`,
  };
}

const newest = (a: StorePost, b: StorePost) =>
  new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

/** Art is the whole point of a shelf, so anything without a cover is out. */
function withArt(posts: StorePost[]): StorePost[] {
  return posts.filter((p) => !!p.cover_url);
}

/**
 * The three banners across the top: best-rated first, newest breaking the
 * tie. Highest rating rather than most recent, because the top of the
 * store is the part that should say what this person is about - and the
 * newest thing they posted is already the first shelf underneath.
 */
export function heroPicks(posts: StorePost[]): StoreItem[] {
  return withArt(posts)
    .slice()
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || newest(a, b))
    .slice(0, HERO_SLOTS)
    .map(toItem);
}

/** "New Releases": what they posted most recently. */
export function recentShelf(posts: StorePost[], slots = SHELF_SLOTS): StoreItem[] {
  return withArt(posts).slice().sort(newest).slice(0, slots).map(toItem);
}

/**
 * "Selected Favorites": the shelf the member fills themselves.
 *
 * This was "Just Added", which was more reviews picked by a rule - and
 * the trouble with a store built entirely out of rules is that none of
 * it is a choice. profile_favorites already exists for exactly this
 * ("hand-picked by the member rather than derived from their reviews -
 * the whole point is that it says what they want it to say"), so the
 * shelf reads that rather than inventing a second way to pin things.
 *
 * Favourites with no artwork still show, unlike reviews on the first
 * shelf: somebody typed this one in on purpose, and dropping it because
 * they had no picture to hand would be the shelf overruling the person
 * it belongs to.
 */
export type FavoriteLike = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
};

export function favoritesShelf(favorites: FavoriteLike[], slots = SHELF_SLOTS * 2): StoreItem[] {
  return favorites.slice(0, slots).map((f) => ({
    id: f.id,
    title: f.title,
    subtitle: f.subtitle ?? "",
    coverUrl: f.imageUrl,
    href: `/search?q=${encodeURIComponent(f.title)}`,
  }));
}

/**
 * The three wide tiles along the bottom: their most popular reviews.
 *
 * Popular means other people did something about it - a like or a
 * comment - not that the author rated it highly. A profile already says
 * what its owner thinks in two other places (the banners are their
 * best-rated, the chart is their best-rated numbered); this is the one
 * slot that reports what everybody ELSE thought, which is the only
 * reason it is worth a third of the width.
 *
 * Comments count double. A like is a tap; a comment is somebody stopping
 * to write something, and on a site this size that is a much stronger
 * signal that a review landed.
 *
 * Ties break on recency, so a profile whose reviews all have one like
 * still shows its newest three rather than the same three forever.
 */
export const COMMENT_WEIGHT = 2;

export function popularShelf(
  posts: StorePost[],
  likes: Map<string, number>,
  comments: Map<string, number>,
  slots = 3
): StoreItem[] {
  const score = (p: StorePost) =>
    (likes.get(p.id) ?? 0) + (comments.get(p.id) ?? 0) * COMMENT_WEIGHT;
  return withArt(posts)
    .slice()
    .sort((a, b) => score(b) - score(a) || newest(a, b))
    .slice(0, slots)
    .map(toItem);
}

/**
 * The chart down the right: their highest-rated, numbered.
 *
 * No cover needed - the chart is a text list in the reference, which is
 * lucky, because it means the chart still fills up on a profile whose
 * reviews have no artwork.
 */
export function chartRows(posts: StorePost[], rows = CHART_ROWS): StoreItem[] {
  return posts
    .slice()
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || newest(a, b))
    .slice(0, rows)
    .map(toItem);
}

/**
 * "Featured Artists": who they write about most, then alphabetical so the
 * list is stable rather than reshuffling every time two artists are level.
 */
export function featuredArtists(posts: StorePost[], max = FEATURED_ARTISTS): string[] {
  const counts = new Map<string, number>();
  for (const p of posts) {
    const name = (p.artist ?? "").trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([name]) => name);
}

/** The "Choose Genre" menu, built from genres this person has actually used. */
export function genresPresent(posts: StorePost[]): string[] {
  const seen = new Set<string>();
  for (const p of posts) {
    const g = (p.genre ?? "").trim();
    if (g) seen.add(g);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/**
 * Whether there is enough here to be a store at all.
 *
 * A shopfront with one record on it looks broken in a way a plain list
 * does not, so a profile below the threshold keeps the ordinary layout.
 */
export function hasStorefront(posts: StorePost[]): boolean {
  return withArt(posts).length >= HERO_SLOTS + 1;
}
