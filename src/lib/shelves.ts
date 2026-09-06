import { MUSIC_ERAS, excludeHits, getTracksByTag, type LastfmTrack } from "@/lib/lastfm";
import { workKey } from "@/lib/taste";
import type { Known } from "@/lib/musicDiscovery";
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
      values: MUSIC_ERAS.filter((era) => era.tag !== null).map((era) => era.tag as string),
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
    case "decade":
      return `The ${value.replace(/^00s$/, "2000s").replace(/^(\d0)s$/, "$1s")}`;
    case "place":
      return value.replace(/\b\w/g, (c) => c.toUpperCase());
    default:
      return value.replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

/** How many records a shelf holds. A wall you can reach the end of. */
export const SHELF_SIZE = 24;

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
export function fillShelf(tracks: LastfmTrack[], known: Known, limit = SHELF_SIZE): Sleeve[] {
  const deep = excludeHits(tracks.slice(SKIP_TOP));
  const from = deep.length >= limit ? deep : excludeHits(tracks);

  const seen = new Set<string>();
  const shelf: Sleeve[] = [];
  for (const track of from) {
    if (!track.name || !track.artist) continue;
    const key = workKey(track.name, track.artist);
    if (seen.has(key) || known.works.has(key)) continue;
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
export async function getShelf(axis: AxisId, value: string, known: Known): Promise<Sleeve[]> {
  // Every axis is a Last.fm tag - "1994", "shoegaze", "detroit", "90s"
  // are all just tags, which is the reason this page can exist at all
  // without a music database of our own.
  const tracks = await getTracksByTag(value, 60).catch(() => []);
  return fillShelf(tracks, known);
}
