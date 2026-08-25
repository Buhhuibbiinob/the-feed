// Curated top lists on the profile: the member picks these by hand rather
// than having them derived from their reviews, which is the point - it's
// the Top 8, not an activity report.

export const FAVORITE_KINDS = ["artist", "movie", "show"] as const;
export type FavoriteKind = (typeof FAVORITE_KINDS)[number];

export const FAVORITE_LABELS: Record<FavoriteKind, string> = {
  artist: "Top artists",
  movie: "Top movies",
  show: "Top shows",
};

export const FAVORITE_SINGULAR: Record<FavoriteKind, string> = {
  artist: "artist",
  movie: "movie",
  show: "show",
};

// Eight each, because the whole reference is the Top 8.
export const MAX_FAVORITES_PER_KIND = 8;

export function isFavoriteKind(value: unknown): value is FavoriteKind {
  return typeof value === "string" && (FAVORITE_KINDS as readonly string[]).includes(value);
}

export type Favorite = {
  id: string;
  kind: FavoriteKind;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  position: number;
};

export function groupFavorites(rows: Favorite[]): Record<FavoriteKind, Favorite[]> {
  const grouped = Object.fromEntries(FAVORITE_KINDS.map((k) => [k, [] as Favorite[]])) as Record<
    FavoriteKind,
    Favorite[]
  >;
  for (const row of rows) grouped[row.kind].push(row);
  for (const kind of FAVORITE_KINDS) grouped[kind].sort((a, b) => a.position - b.position);
  return grouped;
}
