import { excludeHits, getTracksByTag, type LastfmTrack } from "@/lib/lastfm";
import { enrichFinds, rotate } from "@/lib/musicDiscovery";
import { workKey } from "@/lib/taste";
import type { Known } from "@/lib/musicDiscovery";
import { belongsOnShelf, type ShelfSpan } from "@/lib/shelfSpan";
import type { Sleeve } from "@/lib/crate";

// Browsing, rather than being served.
//
// The Crate is chance and Discover is an algorithm. This is the third
// way people actually find music, and the one the site had nothing for:
// walking along a wall of dividers and pulling out the one that says a
// thing you want to hear right now. 1994. Shoegaze. Detroit.
//
// The axis is the whole feature. Nobody has ever wanted "music like the
// music you listen to" as often as they have wanted "something from
// 1979" - because a mood is usually a time or a place or a scene, and
// none of those is a neighbour of your listening history.
//
// So there is no ranking here beyond the one Last.fm's own tag charts
// carry, and even that gets its front trimmed off: the top of a tag is
// that scene's greatest hits, which is the part somebody choosing to
// browse it has already heard.

export type AxisId = "scene" | "year" | "place" | "decade";

export type Axis = {
  id: AxisId;
  /** The divider card at the front of the section. */
  label: string;
  /** What picking one of these gets you, said plainly. */
  prompt: string;
  values: readonly string[];
};

// Scenes. The discovery tags plus the broader ones people actually name
// when they say what they are in the mood for - a wall of dividers that
// only holds microgenres is a wall for people who already know.
const SCENES = [
  "shoegaze", "dream pop", "post-punk", "new wave", "britpop", "grunge",
  "slowcore", "midwest emo", "art pop", "bedroom pop", "hyperpop", "digicore",
  "soul", "neo-soul", "funk", "disco", "gospel", "trip hop",
  "house", "techno", "jungle", "breakcore", "dub", "ambient",
  "krautrock", "no wave", "riot grrrl", "city pop", "bossa nova", "highlife",
  "g-funk", "underground hip hop", "drill", "afrobeats", "plugg", "experimental",
] as const;

// Places with a real presence in Last.fm's tags - a city divider that
// returns nothing is worse than no city divider.
const PLACES = [
  "detroit", "chicago", "new york", "los angeles", "atlanta", "memphis",
  "manchester", "london", "bristol", "glasgow", "dublin",
  "berlin", "cologne", "paris", "gothenburg", "reykjavik",
  "tokyo", "seoul", "lagos", "kingston", "sao paulo", "melbourne",
] as const;

/**
 * The decade wall.
 *
 * This used to borrow MUSIC_ERAS, which is the Feed TV's list of eras and
 * was never a decade wall: it runs 70s to 2010s because those are the
 * decades a television set is worth drawing for. Used here it left the
 * Year wall covering 1960 to this year while the Decade wall covered 1970
 * to 2019, so two thirds of a century had a year divider and no decade
 * to put it under, and everything released since 2020 had nowhere on the
 * wall at all.
 *
 * The tag and the decade are separate fields because they genuinely
 * differ: Last.fm's nineties tag is "90s" and its twenty tens tag is
 * "2010s", and neither is a spelling we get to choose. The label is
 * separate again, because "00s" is a tag and "2000s" is what a person
 * reads, and "20s" on a divider card reads as nineteen twenty.
 */
export type Decade = {
  /** What Last.fm calls it. */
  tag: string;
  /** What the divider card says. */
  label: string;
  startYear: number;
};

const DECADES: readonly Decade[] = [
  { tag: "2020s", label: "2020s", startYear: 2020 },
  { tag: "2010s", label: "2010s", startYear: 2010 },
  { tag: "00s", label: "2000s", startYear: 2000 },
  { tag: "90s", label: "90s", startYear: 1990 },
  { tag: "80s", label: "80s", startYear: 1980 },
  { tag: "70s", label: "70s", startYear: 1970 },
  { tag: "60s", label: "60s", startYear: 1960 },
];

/** The decade a tag names, if it names one. */
export function decadeFor(tag: string): Decade | null {
  return DECADES.find((d) => d.tag === tag) ?? null;
}

/** The first year worth a divider. Earlier tags exist and are thin. */
export const FIRST_YEAR = 1960;

export function yearValues(now: Date = new Date()): string[] {
  const last = now.getFullYear();
  const years: string[] = [];
  // Newest first: somebody browsing by year is far more often after last
  // year than after 1961, and a wall that starts in 1960 buries it.
  for (let year = last; year >= FIRST_YEAR; year--) years.push(String(year));
  return years;
}

export function axes(now: Date = new Date()): Axis[] {
  return [
    {
      id: "scene",
      label: "Scene",
      prompt: "A sound, and the records that belong to it.",
      values: SCENES,
    },
    {
      id: "year",
      label: "Year",
      prompt: "One year, and nothing on either side of it.",
      values: yearValues(now),
    },
    {
      id: "decade",
      label: "Decade",
      prompt: "Ten years at a time, past the songs from the adverts.",
      values: DECADES.map((d) => d.tag),
    },
    {
      id: "place",
      label: "Place",
      prompt: "Where a record came from, which is usually why it sounds like that.",
      values: PLACES,
    },
  ];
}

export function isAxis(value: unknown): value is AxisId {
  return value === "scene" || value === "year" || value === "place" || value === "decade";
}

/**
 * Whether a value belongs to its axis.
 *
 * Checked rather than trusted, because the value goes straight into a
 * Last.fm tag query from the URL. Years are matched by range instead of
 * by list so the divider wall and the guard cannot drift apart in
 * January.
 */
export function isShelfValue(axis: AxisId, value: unknown, now: Date = new Date()): value is string {
  if (typeof value !== "string") return false;
  if (axis === "year") {
    if (!/^\d{4}$/.test(value)) return false;
    const year = Number(value);
    return year >= FIRST_YEAR && year <= now.getFullYear();
  }
  return axes(now).some((a) => a.id === axis && a.values.includes(value));
}

/** How a shelf reads at the top of the page. */
export function shelfTitle(axis: AxisId, value: string): string {
  switch (axis) {
    case "year":
      return value;
    // The decade's own label, rather than its tag dressed up. The old
    // line ran two replaces, and the second one - "90s" for "90s" - did
    // nothing at all while looking like it handled something.
    case "decade":
      return `The ${decadeFor(value)?.label ?? value}`;
    case "place":
      return value.replace(/\b\w/g, (c) => c.toUpperCase());
    default:
      return value.replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

/**
 * The years a shelf is actually claiming, when it claims any.
 *
 * Scene and Place make no falsifiable claim about a date, so they get
 * none. Year and Decade do, in the panel heading, in enormous type, and
 * that is the whole reason this exists.
 */
export function shelfYears(axis: AxisId, value: string): ShelfSpan | null {
  if (axis === "year") {
    const year = Number(value);
    return Number.isFinite(year) ? { from: year, to: year } : null;
  }
  if (axis === "decade") {
    const decade = decadeFor(value);
    return decade ? { from: decade.startYear, to: decade.startYear + 9 } : null;
  }
  return null;
}

/**
 * How many records a shelf holds.
 *
 * Fifty, not twenty four. Filed on their spines a record takes about a
 * fifth of the width a face out cover does, so the same shelf that
 * looked full with twenty four squares looks half empty with twenty four
 * spines - and a rack with gaps in it is a rack somebody has already been
 * through.
 */
export const SHELF_SIZE = 50;

// How far into a tag chart to start. The top is the scene's greatest
// hits, and somebody who chose to browse this shelf has heard those.
const SKIP_TOP = 5;

/**
 * The records on one shelf.
 *
 * Ordered as the tag chart gave them, minus its front and minus the
 * hits - not re-sorted, because re-sorting would be this page having an
 * opinion, and it is the page that does not.
 */
export function fillShelf(
  tracks: LastfmTrack[],
  known: Known,
  limit = SHELF_SIZE,
  rotateBy = 0
): Sleeve[] {
  const deep = excludeHits(tracks.slice(SKIP_TOP));
  const pool = deep.length >= limit ? deep : excludeHits(tracks);
  // Start somewhere else in the pool each time.
  //
  // A shelf asked Last.fm for sixty and always showed the same first
  // twenty four of them, so walking away and coming back gave you the
  // shelf you had already read. Rotating rather than shuffling keeps the
  // chart's own order, which is the only ranking this page has and the
  // reason the records next to each other belong together; it just does
  // not always start at the top.
  const from = rotate(pool, rotateBy);

  const seen = new Set<string>();
  const perArtist = new Map<string, number>();
  const shelf: Sleeve[] = [];
  for (const track of from) {
    if (!track.name || !track.artist) continue;
    const key = workKey(track.name, track.artist);
    if (seen.has(key) || known.works.has(key)) continue;
    // Three each. A scene shelf came back four Slowdive, four My Bloody
    // Valentine and five Have a Nice Life out of twenty four, which is a
    // shelf about three bands rather than about shoegaze.
    const artistKey = track.artist.toLowerCase().trim();
    const already = perArtist.get(artistKey) ?? 0;
    if (already >= 3) continue;
    perArtist.set(artistKey, already + 1);
    seen.add(key);
    shelf.push({
      key,
      name: track.name,
      artist: track.artist,
      imageUrl: track.imageUrl,
      previewUrl: null,
      storeUrl: null,
    });
    if (shelf.length >= limit) break;
  }
  return shelf;
}

/** Everything on one shelf, fetched. */
export async function getShelf(
  axis: AxisId,
  value: string,
  known: Known,
  rotateBy = 0
): Promise<Sleeve[]> {
  // Every axis is a Last.fm tag - "1994", "shoegaze", "detroit", "90s"
  // are all just tags, which is the reason this page can exist at all
  // without a music database of our own.
  // Asked deeper than the shelf shows, so there is something to rotate
  // through: a hundred and twenty gives five shelves' worth before it
  // starts repeating.
  const tracks = await getTracksByTag(value, 120).catch(() => []);
  const shelf = fillShelf(tracks, known, SHELF_SIZE, rotateBy);

  // The first screenful, looked up here rather than in the browser.
  //
  // The client fills in the rest a couple at a time, which is right for
  // fifty records but means the top of the page spends several seconds
  // as blank squares filling in one by one while somebody watches. The
  // rows anybody sees first arrive with their covers and their clips
  // already attached, and the shelf below them catches up quietly.
  const AHEAD = 12;
  const span = shelfYears(axis, value);
  const front = await enrichFinds(
    shelf.slice(0, AHEAD).map((sleeve) => ({ ...sleeve, becauseOf: null }))
  ).catch(() => null);
  if (!front) return shelf;

  // The lookup came back with a release year on it, so the front of the
  // shelf can be checked rather than taken on the tag's word. Anything
  // that does not belong comes off and the shelf closes up behind it
  // from the records below, which are checked in turn in the browser as
  // they are looked up.
  const checked = front
    .filter((find) => belongsOnShelf(find.year, span))
    .map(({ becauseOf: _drop, ...sleeve }) => sleeve);
  return [...checked, ...shelf.slice(AHEAD)];
}
