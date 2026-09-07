import type { SearchFailure, YoutubeVideo } from "@/lib/youtube";
import { workKey } from "@/lib/taste";
import { rotate, shuffleSeed, type Known, type SeedPost, NOTHING_KNOWN } from "@/lib/musicDiscovery";

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

/**
 * Words that push a lane off the beaten track.
 *
 * A lane on its own returns the twenty films anybody could have named.
 * These are the words the archive channels and the cult uploaders
 * actually use, and adding one to a query is the difference between
 * being shown Alien and being shown something you have to look up.
 *
 * They multiply the lane count, which is why there are five rather than
 * twenty: every one of these is another query against a budget the
 * search boxes are also spending. Six of them came to 3,600 units a day
 * against a 3,500 allowance and failed the build, which is exactly what
 * that check is for.
 */
const DEEP_WORDS = ["cult", "obscure", "forgotten", "arthouse", "underrated"] as const;

function laneFor(
  genre: string | null,
  decade: (typeof DECADES)[number],
  deep: (typeof DEEP_WORDS)[number] | null = null
): Lane {
  // "trailer" alone returns fan edits and game footage; "original
  // theatrical trailer" is what the archive channels actually title
  // their uploads, and those are the ones with real films behind them.
  const parts = [deep, genre, "movie original theatrical trailer", `${decade.from}s`].filter(
    Boolean
  );
  return {
    genre,
    decade: decade.tag,
    query: parts.join(" "),
    label: deep
      ? `${deep} ${genre ?? "film"} from ${decade.label}`
      : genre
        ? `${genre} from ${decade.label}`
        : `films from ${decade.label}`,
  };
}

/**
 * Every query this feature is capable of making.
 *
 * The deep lanes are paired one to one with a decade rather than crossed
 * with every genre, which would be a hundred and eighty queries and about
 * six times the budget. Pairing keeps the count at forty and still means
 * a third of what anybody lands on is a lane with "cult" or "forgotten"
 * in it.
 */
export const LANES: Lane[] = [
  ...DECADES.map((d) => laneFor(null, d)),
  ...LANE_GENRES.flatMap((g) => DECADES.map((d) => laneFor(g, d))),
  ...DEEP_WORDS.map((w, i) => laneFor(LANE_GENRES[i % LANE_GENRES.length], DECADES[i % DECADES.length], w)),
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
  // As a phrase, never as a word. "The Game (1997) Original Trailer HD"
  // came out as "The Game Original", because "trailer hd" was stripped
  // as one phrase and left "original" qualifying nothing - but stripping
  // "original" on its own turns "The Original Kings of Comedy" into "The
  // Kings of Comedy", which is a different film. The phrase is safe; the
  // word is not. This has to sit above "trailer hd" so the longer match
  // wins, which is the order the whole list is in.
  "original trailer",
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
  // "Official Trailer #1" leaves a stray 1 on the end of the name once
  // the words around it have gone - "The Fifth Element 1". The hash and
  // its number are the uploader numbering their own uploads, so they go
  // before anything else can mistake the number for part of a title.
  name = name.replace(/#\s*\d+/g, " ");
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
  // Reels. The archive channels post a lot of "11 Classic Horror Movie
  // Trailers from the 70s" and "1980s Horror Movie Trailers", and those
  // reached a shelf as films called exactly that. A film is one film: a
  // count in front of a plural, or a decade in front of one, is a
  // compilation whatever it calls itself.
  if (/^\s*\d+\s+\w+/.test(title) && /\b(trailers|movies|films|classics)\b/i.test(title)) {
    return false;
  }
  if (/\b(19|20)\d0s\b/i.test(title) && /\b(trailers|movies|films|horror|classics)\b/i.test(title)) {
    return false;
  }
  // A title that still says "trailer" after the strip is not a film's
  // name, it is whatever the uploader called their reel.
  if (/\btrailers?\b/i.test(title)) return false;
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
  options: { revalidateSeconds: number; order?: string }
) => Promise<{ videos: YoutubeVideo[]; failure?: SearchFailure }>;

/**
 * A rail of films, from one lane's worth of trailers.
 *
 * The search function is passed in rather than imported so this module
 * stays testable without a key and without a network - the same reason
 * the crate takes its sources rather than reaching for them.
 */
/**
 * How many lanes to try before giving up.
 *
 * A lane can come back with twenty videos and no films: the parser
 * throws away compilations, reaction uploads and fan edits, and some
 * lanes are mostly those. That produced "no trailers came back for that
 * corner today" on a rail whose search had worked perfectly - which
 * reads as breakage and is really just an unlucky corner.
 *
 * Three, not more. Each lane is another hundred units of a ten thousand
 * a day budget, and a lane's answer is cached for the day, so the second
 * and third are usually free after the first person lands on them.
 */
const LANES_TO_TRY = 3;

export async function screenFinds(
  posts: SeedPost[],
  known: Known,
  search: TrailerSearch,
  { limit = 8, rotateBy }: { limit?: number; rotateBy?: number } = {}
): Promise<{
  becauseOf: string | null;
  lane: Lane;
  finds: ScreenFind[];
  /** Why it is empty, when it is empty because something went wrong. */
  failure?: SearchFailure;
}> {
  const spin = rotateBy ?? shuffleSeed();
  const lane = pickLane(posts, spin);
  // Asked for more than the rail shows: parsing throws some away, and a
  // rail that renders four cards because four uploads were compilations
  // looks broken rather than selective.
  // Asked for far more than the rail shows, and then rotated.
  //
  // A lane's answer is cached for the day, so without this everybody in
  // the same lane sees the same eight films in the same order until
  // tomorrow. Rotating the list costs nothing, uses the results already
  // paid for, and is the only way a shared cache and a rail that
  // reshuffles on every load can both be true.
  let tried = lane;
  for (let attempt = 0; attempt < LANES_TO_TRY; attempt++) {
    // A different lane each go, walked by a stride rather than at
    // random so the same visitor on the same day gets the same three -
    // otherwise the cache never hits and every reload costs three more
    // searches.
    tried = attempt === 0 ? lane : LANES[(LANES.indexOf(lane) + attempt * 7) % LANES.length];
    const result = await search(tried.query, limit * 5, {
      revalidateSeconds: TRAILER_TTL_SECONDS,
    }).catch(() => ({ videos: [], failure: { reason: "network" } as SearchFailure }));

    // A search that FAILED is not an empty corner, and trying two more
    // lanes will not fix a missing key or a spent quota - it just burns
    // two hundred more units against a wall. Stop, and say which it was,
    // because "no trailers today" and "trailers are switched off" look
    // identical on the page and only one of them is somebody's problem
    // to fix.
    if (result.failure) {
      return { becauseOf: tried.label, lane: tried, finds: [], failure: result.failure };
    }
    const finds = rankTrailers(rotate(result.videos, spin), known, tried.label, limit);
    if (finds.length > 0) return { becauseOf: tried.label, lane: tried, finds };
  }
  return { becauseOf: tried.label, lane: tried, finds: [] };
}

/**
 * A shelf of films, from a divider somebody chose.
 *
 * screenFinds picks a lane off what you have been reviewing, which is
 * the right behaviour for a rail on Discover and the wrong one here: on
 * Shelves the whole point is that YOU pick the divider, and a shelf that
 * quietly showed you something else would be the page breaking its one
 * promise.
 *
 * So the query is built from the axis and nothing else. It reuses the
 * same phrasing the lanes use - "movie original theatrical trailer" is
 * what the archive channels actually title their uploads, and "trailer"
 * on its own returns fan edits and game footage - and it is a fixed
 * string per divider, which matters for the budget: everybody who opens
 * the seventies horror shelf on the same day shares one cached answer
 * rather than each paying a hundred units for their own.
 */
export function filmShelfQuery(
  axis: "decade" | "genre" | "place",
  value: string,
  deep = false
): string {
  const parts: string[] = [];
  if (deep) parts.push("obscure");
  // A place goes in front as the word a search actually uses: "korean
  // movie trailer" finds Korean cinema and "south korea movie trailer"
  // finds news reports about it. The word comes from the place table
  // rather than from the slug, because for most countries they differ.
  if (axis === "place") parts.push(value);
  if (axis === "genre") parts.push(value);
  // Television and cartoons are not films and must not be searched for
  // as one: "sitcom movie original theatrical trailer" finds nothing,
  // where "sitcom opening titles" finds the thing somebody asked for.
  const onTelevision = ["sitcom", "miniseries", "cartoon", "anime"].includes(value);
  parts.push(
    axis === "genre" && onTelevision
      ? "opening titles intro"
      : "movie original theatrical trailer"
  );
  if (axis === "decade") {
    const start = decadeStartYearForTag(value);
    if (start !== null) parts.push(`${start}s`);
  }
  return parts.join(" ");
}

/** Local, so trailers.ts does not have to import the shelves module. */
function decadeStartYearForTag(tag: string): number | null {
  const four = tag.match(/^([12]\d{3})s$/);
  if (four) return Number(four[1]);
  const two = tag.match(/^(\d{2})s$/);
  if (!two) return null;
  const n = Number(two[1]);
  return n <= new Date().getFullYear() % 100 ? 2000 + n : 1900 + n;
}

export async function filmShelf(
  axis: "decade" | "genre" | "place",
  value: string,
  known: Known,
  search: TrailerSearch,
  { limit = 24, rotateBy = 0 }: { limit?: number; rotateBy?: number } = {}
): Promise<{ finds: ScreenFind[]; failure?: SearchFailure }> {
  const label =
    axis === "genre" ? value : axis === "place" ? `${value} cinema` : `films from the ${value}`;
  // Asked for far more than the shelf shows, then rotated: parsing
  // throws away compilations and fan edits, and the answer is cached for
  // the day, so without the rotation everybody sees the same order until
  // tomorrow.
  const first = await search(filmShelfQuery(axis, value), Math.min(50, limit * 2), {
    revalidateSeconds: TRAILER_TTL_SECONDS,
  }).catch(() => ({ videos: [], failure: { reason: "network" } as SearchFailure }));
  if (first.failure) return { finds: [], failure: first.failure };

  const finds = rankTrailers(rotate(first.videos, rotateBy), known, label, limit);
  // A shelf that came back half full gets one more go with the word the
  // archive uploaders use, which reaches a different set of channels
  // rather than the same ones again.
  if (finds.length < Math.min(8, limit)) {
    const second = await search(filmShelfQuery(axis, value, true), Math.min(50, limit * 2), {
      revalidateSeconds: TRAILER_TTL_SECONDS,
    }).catch(() => ({ videos: [], failure: undefined }));
    const seen = new Set(finds.map((f) => f.key));
    for (const extra of rankTrailers(rotate(second.videos, rotateBy), known, label, limit)) {
      if (seen.has(extra.key)) continue;
      seen.add(extra.key);
      finds.push(extra);
      if (finds.length >= limit) break;
    }
  }
  return { finds };
}

/**
 * Trailers that went up recently. What is coming out, without a
 * catalogue.
 *
 * The home page used to ask TMDB what was in cinemas, which is a better
 * answer to that question and costs money to keep asking - and the whole
 * reason trailers exist on this site is that they do not. So the
 * question changes slightly: not "what is released this month" but "what
 * has a trailer out", which is what anybody actually browses for anyway,
 * and which the studios publish for free.
 *
 * Ordered by upload date rather than relevance, and the query carries no
 * date in it. That is deliberate: putting today into the query would
 * make a new cache key every day AND every time the clock ticked over
 * for somebody in another timezone, which is how a single shared answer
 * becomes one search per visitor. One fixed string, one cached answer, a
 * hundred units a day.
 */
export async function newTrailers(
  search: TrailerSearch,
  limit = 6
): Promise<{ finds: ScreenFind[]; failure?: SearchFailure }> {
  // Always fifty, whatever the caller wants to show.
  //
  // A search costs a hundred units no matter how many rows come back, so
  // asking for fewer saves nothing - and the row count is part of the
  // URL, which is the cache key. The home page wanted six and the new
  // releases page wanted twenty, which made two different URLs, two
  // cache entries and two hundred units a day for one question asked
  // twice. Fixed at fifty they share one answer and the caller slices
  // it, which is a hundred units for both and a deeper pool to slice
  // from.
  const result = await search("movie official trailer", 50, {
    revalidateSeconds: TRAILER_TTL_SECONDS,
    order: "date",
  }).catch(() => ({ videos: [], failure: { reason: "network" } as SearchFailure }));
  if (result.failure) return { finds: [], failure: result.failure };
  // Nothing is filtered out for having been reviewed here: this is a
  // "what is out" shelf, not a recommendation, and hiding a film from it
  // because one person wrote about it would make the shelf wrong for
  // everybody else.
  return { finds: rankTrailers(result.videos, NOTHING_KNOWN, null, limit) };
}
