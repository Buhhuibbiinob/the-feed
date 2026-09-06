import type { YoutubeVideo } from "@/lib/youtube";
import { workKey } from "@/lib/taste";
import { rotate, shuffleSeed, type Known, type SeedPost } from "@/lib/musicDiscovery";

// Films and shows in Discover, without a paid catalogue behind them.
//
// This used to be TMDB, which wants an API key that costs money, for a
// rail that mostly needed a poster and a title. YouTube already has both
// for anything worth watching: every film ever released has a trailer on
// it, the trailer has a thumbnail, and the thumbnail is a better advert
// for a film than a poster is anyway, because it moves.
//
// THE QUOTA IS THE WHOLE DESIGN.
//
// A YouTube search costs 100 units of a 10,000-a-day allowance. Discover
// renders on every visit and deliberately reshuffles each time, so a
// search per render would burn the day's quota in a hundred page views
// and hand everybody the 429 that was already annoying enough to
// complain about once.
//
// So the rail does not search for what it wants. It picks a LANE - one
// genre crossed with one decade - out of a fixed, small list, and asks
// for that lane's one fixed query. Two consequences, both of them the
// point:
//
//   1. The number of distinct queries the whole site can ever make is
//      LANES.length, not one per visitor. Every visitor who lands in the
//      same lane on the same day shares one cached answer.
//   2. Because the query text is fixed rather than assembled from a
//      person's own taste words, Next's fetch cache actually hits. A
//      query with somebody's favourite band spliced into it is a
//      different string every time and caches nothing.
//
// The arithmetic is checked rather than trusted: see scripts/trailer-check.ts.

/**
 * How long a lane's answer is held.
 *
 * A day. That sounds slow for a rail the brief asks to refresh on every
 * page load, but the refresh does not come from the ANSWER changing - it
 * comes from the LANE changing, and the lane is picked per request. So a
 * reload still shows different films; it just shows them out of a set of
 * answers the whole site is sharing, which is the only way the numbers
 * work at 100 units a search.
 */
export const TRAILER_TTL_SECONDS = 24 * 60 * 60;
/** Refreshes a lane can cost in a day, given the TTL above. */
export const REFRESHES_PER_DAY = Math.ceil((24 * 60 * 60) / TRAILER_TTL_SECONDS);
/** What one search costs against YouTube's daily allowance. */
export const UNITS_PER_SEARCH = 100;
export const DAILY_UNIT_BUDGET = 10000;
/**
 * The share of the day's quota Discover may spend. The search boxes are
 * the other tenant and they matter more, because somebody typing and
 * getting nothing back is a broken feature, while a stale trailer rail
 * is just yesterday's trailers.
 */
export const DISCOVER_QUOTA_SHARE = 0.35;

export type Lane = {
  /** Our genre slug, or null for a lane that is only a decade. */
  genre: string | null;
  /** The decade tag, matching the music rails' vocabulary. */
  decade: string;
  /** The exact string sent to YouTube. Fixed, so the cache can hit. */
  query: string;
  /** What the rail says about why these are here. */
  label: string;
};

const DECADES: { tag: string; label: string; from: number }[] = [
  { tag: "70s", label: "the seventies", from: 1970 },
  { tag: "80s", label: "the eighties", from: 1980 },
  { tag: "90s", label: "the nineties", from: 1990 },
  { tag: "00s", label: "the two thousands", from: 2000 },
  { tag: "10s", label: "the twenty tens", from: 2010 },
];

/**
 * The genres a lane can be about.
 *
 * Five, not the site's full genre list, and the number is load-bearing.
 * Every genre here is another five queries, and five queries is another
 * 500 units of a budget that is 3,500. Eight genres came to 4,500 and
 * would have taken the search boxes down with it. These five have the
 * strongest trailer culture, which is also where the archive uploads
 * actually are.
 */
const LANE_GENRES = ["horror", "sci-fi", "thriller", "comedy", "crime"] as const;

function laneFor(genre: string | null, decade: (typeof DECADES)[number]): Lane {
  // "trailer" alone returns fan edits and game footage; "original
  // theatrical trailer" is what the archive channels actually title
  // their uploads, and those are the ones with real films behind them.
  const words = genre
    ? `${genre} movie original theatrical trailer ${decade.from}s`
    : `movie original theatrical trailer ${decade.from}s`;
  return {
    genre,
    decade: decade.tag,
    query: words,
    label: genre ? `${genre} from ${decade.label}` : `films from ${decade.label}`,
  };
}

/** Every query this feature is capable of making. */
export const LANES: Lane[] = [
  ...DECADES.map((d) => laneFor(null, d)),
  ...LANE_GENRES.flatMap((g) => DECADES.map((d) => laneFor(g, d))),
];

/** What Discover's trailer rail costs YouTube in a worst-case day. */
export function worstCaseDailyUnits(): number {
  return LANES.length * REFRESHES_PER_DAY * UNITS_PER_SEARCH;
}

export type ScreenFind = {
  key: string;
  /** The YouTube video id, so the card can play the trailer in place. */
  videoId: string;
  title: string;
  year: string | null;
  imageUrl: string | null;
  channel: string;
  kind: "movie" | "tv";
  /** The lane that put it here, so a card can say why. */
  becauseOf: string | null;
};

// Everything an uploader adds around the name of the film. Ordered
// longest first so "official theatrical trailer" is removed as one
// phrase rather than leaving "theatrical" behind.
const NOISE = [
  "original theatrical trailer",
  "official theatrical trailer",
  "official uk trailer",
  "official us trailer",
  "official full trailer",
  "official final trailer",
  "restored trailer",
  "theatrical trailer",
  "official trailer",
  "final trailer",
  "teaser trailer",
  "full trailer",
  "movie trailer",
  "trailer hd",
  "re release trailer",
  "rerelease trailer",
  "trailer",
  "teaser",
  "remastered",
  "subtitulado",
  "legendado",
  "hd",
  "4k",
  "1080p",
  "720p",
];

const SEPARATORS = /\s+[|•·–—]\s+|\s+-\s+/;

/**
 * The film's name, out of whatever the uploader called the upload.
 *
 * Titles arrive in a handful of shapes and all of them put the name
 * first:
 *
 *   "THE THING (1982) - Original Theatrical Trailer"
 *   "Alien | Official Trailer | 20th Century FOX"
 *   "Heat - Official Trailer [HD]"
 *
 * So: cut at the first separator, then strip the bracketed asides and
 * the noise words, then put it back into normal case if the uploader
 * shouted it. Anything left that is empty or absurd is dropped by the
 * caller rather than shown as a card with no name on it.
 */
export function filmTitleFromVideo(videoTitle: string): { title: string; year: string | null } {
  const year = videoTitle.match(/\b(19[3-9]\d|20[0-3]\d)\b/)?.[1] ?? null;

  const head = videoTitle.split(SEPARATORS)[0] ?? videoTitle;
  // Bracketed asides go wholesale: they are years, formats and cast lists.
  let name = head.replace(/[([{][^)\]}]*[)\]}]/g, " ").toLowerCase();
  for (const phrase of NOISE) {
    name = name.replace(new RegExp(`\\b${phrase.replace(/ /g, "\\s+")}\\b`, "g"), " ");
  }
  // A year outside brackets survives the strip above and ends up in the
  // name: "Night of the Living Dead 1968". It has already been captured.
  name = name.replace(/\b(19[3-9]\d|20[0-3]\d)\b/g, " ");
  const cleaned = name.replace(/[^a-z0-9'’:!?&.,\s-]/g, " ").replace(/\s+/g, " ").trim();
  const trimmed = cleaned.replace(/[\s:,.\-]+$/, "").replace(/^[\s:,.\-]+/, "");

  return { title: titleCase(trimmed), year };
}

// Uploaders shout. "THE THING" as a card title next to "Blade Runner"
// reads as a mistake, so everything is normalised to the same case.
const SMALL_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into",
  "nor", "of", "on", "onto", "or", "over", "the", "to", "up", "with",
]);
function titleCase(s: string): string {
  const words = s.split(" ").filter(Boolean);
  return words
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (i > 0 && i < words.length - 1 && SMALL_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/** A title too short, too long or too generic to be a film. */
export function looksLikeAFilm(title: string): boolean {
  if (title.length < 2 || title.length > 70) return false;
  // A name that is only digits is a year that survived the strip.
  if (/^[\d\s]+$/.test(title)) return false;
  // Compilations, not films.
  // `top \d` without the + matched the 1 of "top 10" and then failed its
  // word boundary against the 0, so every listicle got through.
  if (/\b(top \d+|best of|compilation|every|all the|reaction|review|explained|breakdown)\b/i.test(title)) {
    return false;
  }
  return true;
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
 * Which lane this person gets.
 *
 * Their own genres first, so somebody who rates horror highly lands in a
 * horror lane; the decade rotates so the rail is not the same eight
 * films forever. Somebody with no film reviews yet gets a lane with no
 * genre in it, which is a wider net rather than an empty one.
 */
export function pickLane(posts: SeedPost[], spin: number): Lane {
  const loved = lovedScreenGenres(posts).filter((g) =>
    (LANE_GENRES as readonly string[]).includes(g)
  );
  const genre = loved.length > 0 ? rotate(loved, spin)[0] : null;
  const inLane = LANES.filter((l) => l.genre === genre);
  const pool = inLane.length > 0 ? inLane : LANES.filter((l) => l.genre === null);
  return rotate(pool, spin)[0];
}

/**
 * YouTube rows into cards.
 *
 * Same two rules as every other rail: nothing this person has already
 * reviewed, and nothing twice. Keyed on the parsed film title rather
 * than the video id, so two uploads of the same trailer collapse into
 * one card instead of sitting next to each other.
 */
export function rankTrailers(
  videos: YoutubeVideo[],
  known: Known,
  becauseOf: string | null,
  limit: number
): ScreenFind[] {
  const seen = new Set<string>();
  const out: ScreenFind[] = [];
  for (const video of videos) {
    const { title, year } = filmTitleFromVideo(video.title);
    if (!looksLikeAFilm(title)) continue;
    const key = workKey(title, null);
    if (seen.has(key) || known.works.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      videoId: video.id,
      title,
      year,
      imageUrl: video.thumbnailUrl,
      channel: video.channelTitle,
      // Everything a trailer lane returns is a film. Television gets its
      // own lane vocabulary the day somebody asks for it; claiming a
      // series is a film is worse than not offering series at all.
      kind: "movie",
      becauseOf,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export type TrailerSearch = (
  query: string,
  limit: number,
  options: { revalidateSeconds: number }
) => Promise<YoutubeVideo[]>;

/**
 * A rail of films, from one lane's worth of trailers.
 *
 * The search function is passed in rather than imported so this module
 * stays testable without a key and without a network - the same reason
 * the crate takes its sources rather than reaching for them.
 */
export async function screenFinds(
  posts: SeedPost[],
  known: Known,
  search: TrailerSearch,
  { limit = 8, rotateBy }: { limit?: number; rotateBy?: number } = {}
): Promise<{ becauseOf: string | null; lane: Lane; finds: ScreenFind[] }> {
  const spin = rotateBy ?? shuffleSeed();
  const lane = pickLane(posts, spin);
  // Asked for more than the rail shows: parsing throws some away, and a
  // rail that renders four cards because four uploads were compilations
  // looks broken rather than selective.
  const videos = await search(lane.query, limit * 3, {
    revalidateSeconds: TRAILER_TTL_SECONDS,
  }).catch(() => []);
  return { becauseOf: lane.label, lane, finds: rankTrailers(videos, known, lane.label, limit) };
}
