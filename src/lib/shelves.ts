import { GENRES } from "@/lib/genres";
import { excludeHits, getTracksByTag, tagText, type LastfmTrack } from "@/lib/lastfm";
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

export type AxisId = "scene" | "year" | "place" | "decade" | "genre" | "subject";

/**
 * What a wall of shelves is a wall OF.
 *
 * The page was only ever music, and its axes were built for music: a
 * scene, a place, a year. Film and photography want different ones, and
 * forcing them through the music axes would give a Detroit shelf of
 * films (a tagging argument, not a shelf) and a 1994 shelf of members'
 * photographs (a date the site does not hold).
 *
 * So the medium comes first and picks the axes, rather than every
 * medium sharing one set. It is also where the three of them differ
 * most: music and film come from catalogues out on the internet, and
 * photography comes from what people here have actually posted, which
 * is the only honest source for it - there is no archive of members'
 * own photographs to query.
 */
export type Medium = "music" | "film" | "photography";

export function isMedium(value: unknown): value is Medium {
  return value === "music" || value === "film" || value === "photography";
}

export const MEDIA: { id: Medium; label: string; blurb: string }[] = [
  { id: "music", label: "Music", blurb: "Records, by when or where or what they are." },
  { id: "film", label: "Film", blurb: "Trailers, by decade and by kind." },
  { id: "photography", label: "Photography", blurb: "What people here have shot, by subject." },
];

export type Axis = {
  id: AxisId;
  /** The divider card at the front of the section. */
  label: string;
  /** What picking one of these gets you, said plainly. */
  prompt: string;
  values: readonly string[];
};

/**
 * Every sound the site knows about.
 *
 * Thirty-six, chosen by hand, and the wall behind them was the same
 * thirty-six for everybody forever. The taxonomy already lists three
 * hundred and seventy-four music genres in families, which is the wall
 * this was always trying to be, so it is that now.
 *
 * Ordered by family rather than alphabetically, so the dividers read as
 * neighbourhoods - all the house under one another, all the metal
 * together - which is how anybody actually walks along a wall of them.
 *
 * These are slugs, and Last.fm files its tags with spaces, so getShelf
 * converts on the way out. That conversion lives in one place rather
 * than here, because the same slug is also a genre badge on a post and
 * has to stay a slug for that.
 */
const SCENES: readonly string[] = GENRES.music;

/**
 * Where records come from.
 *
 * Twenty-two, and eleven of them were in America or Britain. A wall
 * called Place that is half two countries is not a wall about place, it
 * is a wall about the two scenes everybody already knows, and it is one
 * of the reasons the same artists kept coming round.
 *
 * A hundred and thirty-nine now, on every inhabited continent. Cities where a scene really
 * did happen, and regions where the scene is the region rather than any
 * one city - a Last.fm tag for "mali" returns more, and better, than a
 * tag for Bamako would.
 *
 * The test for being on this list is not fame, it is whether the tag
 * comes back with records on it. A divider that opens onto nothing is
 * worse than no divider, so this is not a map: Antarctica is not missing
 * because nobody thought of it.
 */
const PLACES = [
  // Britain and Ireland
  "london", "manchester", "bristol", "sheffield", "leeds", "liverpool",
  "glasgow", "birmingham", "coventry", "belfast", "dublin", "cardiff",
  // The United States
  "new york", "brooklyn", "los angeles", "detroit", "chicago", "memphis",
  "atlanta", "new orleans", "houston", "philadelphia", "seattle", "portland",
  "san francisco", "oakland", "miami", "baltimore", "washington dc", "minneapolis",
  "austin", "nashville", "muscle shoals", "bakersfield",
  // The rest of the Americas
  "toronto", "montreal", "vancouver", "mexico city", "monterrey", "havana",
  "kingston", "port of spain", "san juan", "medellin", "bogota", "lima",
  "sao paulo", "rio de janeiro", "salvador", "buenos aires", "santiago",
  // Europe
  "berlin", "cologne", "dusseldorf", "hamburg", "munich", "paris", "marseille",
  "brussels", "amsterdam", "rotterdam", "copenhagen", "stockholm", "gothenburg",
  "oslo", "bergen", "helsinki", "reykjavik", "lisbon", "madrid", "barcelona",
  "milan", "rome", "naples", "athens", "istanbul", "warsaw", "krakow",
  "prague", "budapest", "belgrade", "zagreb", "bucharest", "kyiv", "moscow",
  "saint petersburg", "tbilisi",
  // Africa
  "lagos", "accra", "abidjan", "dakar", "bamako", "mali", "kinshasa",
  "johannesburg", "durban", "cape town", "nairobi", "dar es salaam",
  "addis ababa", "cairo", "algiers", "casablanca", "luanda",
  // Asia
  "tokyo", "osaka", "seoul", "beijing", "shanghai", "taipei", "hong kong",
  "manila", "jakarta", "bandung", "bangkok", "ho chi minh city", "singapore",
  "kuala lumpur", "mumbai", "delhi", "chennai", "kolkata", "lahore", "karachi",
  "dhaka", "colombo", "kathmandu", "tel aviv", "beirut", "tehran", "dubai",
  // Oceania
  "melbourne", "sydney", "brisbane", "perth", "auckland", "wellington",
  "honolulu", "suva",
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

/**
 * The kinds of film a shelf can be about.
 *
 * The same five the trailer lanes already use, and the same five for the
 * same reason: every one is another YouTube search against a ten
 * thousand a day budget, and a wall of twenty kinds would be a wall
 * nobody could afford to walk along. These are also the five that
 * actually have archive uploads behind them.
 */
const FILM_KINDS = ["horror", "sci-fi", "thriller", "comedy", "crime"] as const;

/**
 * What a photography shelf can be about.
 *
 * Subject, because that is the only axis a wall of members' own
 * photographs can honestly have. There is no release year for somebody's
 * photograph and no scene it belongs to; there is what it is a picture
 * of, which is exactly what the genre on the post already says.
 */
const PHOTO_SUBJECTS = [
  "portrait", "street", "landscape", "nature", "fashion", "documentary",
  "architecture", "wildlife", "macro", "still-life", "night", "travel",
  "black-and-white", "analogue", "polaroid", "abstract", "photojournalism", "editorial",
] as const;

/**
 * Where films come from.
 *
 * A place wall for film, which the site did not have. It is not the same
 * shape as the music one: nobody searches for films from Bristol, they
 * search for Korean films, or Hong Kong cinema, or Nollywood - film
 * travels as a national or regional cinema in a way records do not.
 *
 * Each one carries the word that actually goes in the query, because
 * that word is rarely the place: the search term for South Korea is
 * "korean", for Nigeria it is "nollywood", and for Hong Kong it is the
 * place after all. A slug alone could not know that.
 */
export type FilmPlace = { slug: string; label: string; term: string };

const FILM_PLACES: readonly FilmPlace[] = [
  { slug: "korean", label: "Korea", term: "korean" },
  { slug: "japanese", label: "Japan", term: "japanese" },
  { slug: "hong-kong", label: "Hong Kong", term: "hong kong" },
  { slug: "chinese", label: "China", term: "chinese" },
  { slug: "taiwanese", label: "Taiwan", term: "taiwanese" },
  { slug: "thai", label: "Thailand", term: "thai" },
  { slug: "indonesian", label: "Indonesia", term: "indonesian" },
  { slug: "filipino", label: "Philippines", term: "filipino" },
  { slug: "bollywood", label: "India", term: "bollywood" },
  { slug: "tamil", label: "Tamil", term: "tamil" },
  { slug: "iranian", label: "Iran", term: "iranian" },
  { slug: "turkish", label: "Turkey", term: "turkish" },
  { slug: "israeli", label: "Israel", term: "israeli" },
  { slug: "lebanese", label: "Lebanon", term: "lebanese" },
  { slug: "egyptian", label: "Egypt", term: "egyptian" },
  { slug: "nollywood", label: "Nigeria", term: "nollywood" },
  { slug: "senegalese", label: "Senegal", term: "senegalese" },
  { slug: "south-african", label: "South Africa", term: "south african" },
  { slug: "moroccan", label: "Morocco", term: "moroccan" },
  { slug: "french", label: "France", term: "french" },
  { slug: "italian", label: "Italy", term: "italian" },
  { slug: "spanish", label: "Spain", term: "spanish" },
  { slug: "german", label: "Germany", term: "german" },
  { slug: "polish", label: "Poland", term: "polish" },
  { slug: "czech", label: "Czechia", term: "czech" },
  { slug: "hungarian", label: "Hungary", term: "hungarian" },
  { slug: "romanian", label: "Romania", term: "romanian" },
  { slug: "soviet", label: "Soviet", term: "soviet" },
  { slug: "russian", label: "Russia", term: "russian" },
  { slug: "swedish", label: "Sweden", term: "swedish" },
  { slug: "danish", label: "Denmark", term: "danish" },
  { slug: "norwegian", label: "Norway", term: "norwegian" },
  { slug: "icelandic", label: "Iceland", term: "icelandic" },
  { slug: "irish", label: "Ireland", term: "irish" },
  { slug: "british", label: "Britain", term: "british" },
  { slug: "australian", label: "Australia", term: "australian" },
  { slug: "new-zealand", label: "New Zealand", term: "new zealand" },
  { slug: "canadian", label: "Canada", term: "canadian" },
  { slug: "quebec", label: "Québec", term: "quebecois" },
  { slug: "mexican", label: "Mexico", term: "mexican" },
  { slug: "brazilian", label: "Brazil", term: "brazilian" },
  { slug: "argentine", label: "Argentina", term: "argentine" },
  { slug: "chilean", label: "Chile", term: "chilean" },
  { slug: "colombian", label: "Colombia", term: "colombian" },
  { slug: "cuban", label: "Cuba", term: "cuban" },
];

/** The query word for a film place, if it is one. */
export function filmPlaceTerm(slug: string): string | null {
  return FILM_PLACES.find((p) => p.slug === slug)?.term ?? null;
}

export function filmPlaceLabel(slug: string): string | null {
  return FILM_PLACES.find((p) => p.slug === slug)?.label ?? null;
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

export function axes(now: Date = new Date(), medium: Medium = "music"): Axis[] {
  if (medium === "film") {
    return [
      {
        id: "decade",
        label: "Decade",
        prompt: "Ten years of film, past the ones everybody has seen.",
        // The same decades as the music wall. The filter that used to
        // be here read `startYear >= 1960` and did nothing at all, since
        // the earliest decade in the table IS the sixties - a condition
        // that looks like a rule and excludes nothing is worse than no
        // condition, because the next person reads it as a decision
        // somebody made.
        values: DECADES.map((d) => d.tag),
      },
      {
        id: "genre",
        label: "Kind",
        prompt: "One kind of film, and the corners of it worth digging through.",
        values: FILM_KINDS,
      },
      {
        id: "place",
        label: "Place",
        prompt: "A country's own cinema, which is usually why it looks like that.",
        values: FILM_PLACES.map((p) => p.slug),
      },
    ];
  }
  if (medium === "photography") {
    return [
      {
        id: "subject",
        label: "Subject",
        prompt: "What it is a picture of, shot by people here.",
        values: PHOTO_SUBJECTS,
      },
    ];
  }
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
  return (
    value === "scene" ||
    value === "year" ||
    value === "place" ||
    value === "decade" ||
    value === "genre" ||
    value === "subject"
  );
}

/**
 * Whether a value belongs to its axis.
 *
 * Checked rather than trusted, because the value goes straight into a
 * Last.fm tag query from the URL. Years are matched by range instead of
 * by list so the divider wall and the guard cannot drift apart in
 * January.
 */
export function isShelfValue(
  axis: AxisId,
  value: unknown,
  now: Date = new Date(),
  medium: Medium = "music"
): value is string {
  if (typeof value !== "string") return false;
  if (axis === "year") {
    if (!/^\d{4}$/.test(value)) return false;
    const year = Number(value);
    return year >= FIRST_YEAR && year <= now.getFullYear();
  }
  return axes(now, medium).some((a) => a.id === axis && a.values.includes(value));
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
    // A film place is titled from its own label: the slug is a query
    // word, not a name, so "quebec" should read Québec and "nollywood"
    // should read Nigeria.
    case "place":
      return filmPlaceLabel(value) ?? value.replace(/\b\w/g, (c) => c.toUpperCase());
    // A hyphenated genre is a slug, not a label: "still-life" and
    // "black-and-white" are what the database calls them and not what a
    // divider card should say.
    case "genre":
    case "subject":
      return value.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
  // Scene values are genre slugs and Last.fm files its tags with spaces,
  // so "uk-garage" has to be asked for as "uk garage" or the shelf comes
  // back empty and reports it as a thin corner of the catalogue. Year,
  // decade and place are already tag text and pass through unchanged.
  const tag = axis === "scene" ? tagText(value) : value;
  const tracks = await getTracksByTag(tag, 120).catch(() => []);
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
