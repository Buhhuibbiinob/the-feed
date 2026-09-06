import {
  MOVIE_GENRE_WORDS,
  TV_GENRE_WORDS,
  discoverDeepCuts,
  type TmdbRecommendation,
} from "@/lib/tmdb";
import { workKey } from "@/lib/taste";
import { rotate, shuffleSeed, type Known, type SeedPost } from "@/lib/musicDiscovery";

// The same idea as the music rails, for things you watch.
//
// Discover was music only, which on a site whose second category is film
// and television meant half the members had nothing to find. The shape
// is deliberately identical - seeded by what somebody rates highly,
// deep rather than popular, and reshuffled on every load - because the
// two rails sitting next to each other should behave the same way.

export type ScreenFind = {
  key: string;
  id: string;
  title: string;
  year: string | null;
  imageUrl: string | null;
  overview: string;
  rating: number;
  kind: "movie" | "tv";
  /** The genre that put it here, so a card can say why. */
  becauseOf: string | null;
};

/** How deep into TMDB's ranking a refresh may reach. */
const MAX_PAGE = 5;

/**
 * Our genre slug to TMDB's id.
 *
 * The two vocabularies mostly agree, because both are the ordinary
 * English names - so the existing keyword maps do the work, with the
 * handful that differ spelled out. Movies and television have separate
 * namespaces at TMDB (television has no bare "Action"; it is bundled
 * into "Action & Adventure"), which is why the kind has to be passed.
 */
export function tmdbGenreForSlug(slug: string, kind: "movie" | "tv"): number | undefined {
  const words = kind === "movie" ? MOVIE_GENRE_WORDS : TV_GENRE_WORDS;
  const direct = words[slug];
  if (direct) return direct;
  // Our slugs hyphenate what the keyword map spaces.
  return words[slug.replace(/-/g, " ")];
}

/** The film and television genres somebody keeps rating four and five. */
export function lovedScreenGenres(posts: SeedPost[], limit = 3): string[] {
  const tally = new Map<string, number>();
  for (const post of posts) {
    if (post.media_type !== "movie_tv") continue;
    if ((post.rating ?? 0) < 4 || !post.genre) continue;
    tally.set(post.genre, (tally.get(post.genre) ?? 0) + 1);
  }
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([genre]) => genre)
    .slice(0, limit);
}

/**
 * Turns TMDB rows into the row that gets shown.
 *
 * Same two rules as the music rails: nothing somebody has already
 * reviewed, and nothing twice.
 */
export function rankScreenFinds(
  rows: TmdbRecommendation[],
  known: Known,
  becauseOf: string | null,
  limit: number
): ScreenFind[] {
  const seen = new Set<string>();
  const out: ScreenFind[] = [];
  for (const row of rows) {
    if (!row.title) continue;
    // Keyed on title alone: a film has no artist, and TMDB's title is
    // what somebody would have typed when reviewing it here.
    const key = workKey(row.title, null);
    if (seen.has(key) || known.works.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      id: row.id,
      title: row.title,
      year: row.date ? row.date.slice(0, 4) : null,
      imageUrl: row.imageUrl,
      overview: row.overview,
      rating: row.rating,
      kind: row.mediaType,
      becauseOf,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * A rail of films and shows.
 *
 * Seeded by the genres this person rates highly, falling back to no
 * genre at all - which still returns well-regarded, little-seen titles,
 * because the vote ceiling does that work rather than the genre does.
 * Movies and television are asked for together and interleaved, so the
 * rail is not eight films with the shows pushed off the end.
 */
export async function screenFinds(
  posts: SeedPost[],
  known: Known,
  { limit = 8, rotateBy }: { limit?: number; rotateBy?: number } = {}
): Promise<{ becauseOf: string | null; finds: ScreenFind[] }> {
  const spin = rotateBy ?? shuffleSeed();
  const loved = lovedScreenGenres(posts);
  const slug = loved.length > 0 ? rotate(loved, spin)[0] : null;
  const page = (Math.abs(spin) % MAX_PAGE) + 1;

  const [movies, shows] = await Promise.all([
    discoverDeepCuts("movie", slug ? tmdbGenreForSlug(slug, "movie") : undefined, page).catch(
      () => []
    ),
    discoverDeepCuts("tv", slug ? tmdbGenreForSlug(slug, "tv") : undefined, page).catch(() => []),
  ]);

  // One of each in turn. Taking movies first and shows after would put
  // the shows past the end of a short rail every time.
  const mixed: TmdbRecommendation[] = [];
  for (let i = 0; i < Math.max(movies.length, shows.length); i++) {
    if (movies[i]) mixed.push(movies[i]);
    if (shows[i]) mixed.push(shows[i]);
  }

  return { becauseOf: slug, finds: rankScreenFinds(mixed, known, slug, limit) };
}
