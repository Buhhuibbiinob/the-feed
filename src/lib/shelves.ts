import { GENRES, genreLabel } from "@/lib/genres";
import { excludeHits, getTracksByTag, tagText, type LastfmTrack } from "@/lib/lastfm";
import { dayIndex, rotate } from "@/lib/musicDiscovery";
import { getYoutubeSceneShelf, isYoutubeScene } from "@/lib/youtubeScenes";
import type { SearchFailure } from "@/lib/youtube";
import { workKey } from "@/lib/taste";
import type { Known } from "@/lib/musicDiscovery";
import { type ShelfSpan } from "@/lib/shelfSpan";
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

export const MEDIA: { id: Medium; label: string; blurb: string; comingSoon?: boolean }[] = [
  { id: "music", label: "Music", blurb: "Records, by when or where or what they are." },
  { id: "film", label: "Film", blurb: "Trailers, by decade and by kind." },
  {
    id: "photography",
    label: "Photography",
    blurb: "Coming soon, once uploading a photograph works.",
    comingSoon: true,
  },
];

/**
 * Whether a wall is real yet.
 *
 * The photography wall reads the site's own posts, which is the right
 * source and the only honest one - and it means the wall cannot show
 * anything until people can actually put photographs up, which they
 * cannot. A wall of empty subjects is not a quiet feature, it is a
 * feature that looks broken, and every subject on it says "nobody has
 * shelved one yet" as though thirty-nine people had all declined to.
 *
 * So it says what it is. It stays on the page rather than being deleted,
 * because it is coming and the wall is built.
 */
export function isComingSoon(medium: Medium): boolean {
  return MEDIA.find((m) => m.id === medium)?.comingSoon === true;
}

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
 * Well over two hundred now, on every inhabited continent. Cities where a scene really
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
  // The United States, cities
  "new york", "brooklyn", "queens", "the bronx", "harlem", "staten island",
  "long island", "newark", "boston", "providence", "philadelphia", "pittsburgh",
  "baltimore", "washington dc", "richmond", "virginia beach", "norfolk",
  "atlanta", "miami", "orlando", "new orleans", "memphis", "nashville",
  "muscle shoals", "louisville", "houston", "dallas", "austin", "san antonio",
  "oklahoma city", "tulsa", "kansas city", "st louis", "chicago", "detroit",
  "flint", "ann arbor", "gary", "indianapolis", "columbus", "cleveland",
  "dayton", "akron", "milwaukee", "minneapolis", "omaha", "denver",
  "albuquerque", "phoenix", "las vegas", "salt lake city", "boise",
  "seattle", "portland", "sacramento", "san francisco", "oakland", "vallejo",
  "los angeles", "compton", "long beach", "inglewood", "san diego", "bakersfield",
  "athens georgia", "chapel hill", "asbury park", "laurel canyon", "honolulu",
  // The United States, states and regions
  //
  // Named because whole scenes here are a state rather than a city, and
  // a wall of only cities loses them. Virginia is Pharrell, Timbaland,
  // Missy and Clipse; Indiana is the Jackson 5 and Mellencamp; the delta
  // and Appalachia are where two whole musics come from. Both of the
  // ones that got reported missing are on this line.
  "virginia", "indiana", "ohio", "michigan", "georgia", "tennessee",
  "kentucky", "north carolina", "south carolina", "alabama", "mississippi",
  "louisiana", "arkansas", "missouri", "texas", "oklahoma", "kansas",
  "iowa", "nebraska", "wisconsin", "minnesota", "colorado", "california",
  "florida", "new jersey", "delta blues country", "appalachia", "the dmv",
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
  "melbourne", "sydney", "brisbane", "perth", "auckland", "wellington", "suva",
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
const FILM_KINDS = [
  "horror",
  "sci-fi",
  "thriller",
  "comedy",
  "crime",
  // Television and cartoons belong on the same wall rather than on one
  // of their own. Nobody browsing for something to watch is sorting by
  // whether it was made for a cinema, and the archive uploads these
  // share are the same shape: a trailer or an opening.
  "anime",
  "cartoon",
  "animation",
  "documentary",
  "action",
  "romance",
  "fantasy",
  "western",
  "musical",
  "noir",
  "martial-arts",
  "sitcom",
  "miniseries",
] as const;

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
    //
    // Titled by genreLabel rather than by title-casing the slug here,
    // which is where "Uk-Rnb" came from - printed on the divider, on the
    // chip and in the breadcrumb, on a shelf whose whole point was that
    // somebody asked for UK R&B by name. Title-casing also left the
    // hyphens in, so the wall read Quiet-Storm and New-Jack-Swing.
    //
    // lib/genres already knows every one of these, including the ones no
    // rule gets right: UK R&B, PluggnB, HexD, Brit-Funk, PBR&B, K-Pop.
    // Doing it twice, in two files, by two different rules, is how one
    // of them ends up wrong.
    case "genre":
    case "subject":
    case "scene":
      return genreLabel(value);
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

/**
 * How many extra records come back beyond the ones on show.
 *
 * Replacements. A record whose cover and clip the catalogue does not
 * have is a blank sleeve with nothing to press, and the shelf trades it
 * for one of these the moment the lookup says so - so what is on the
 * boards is what actually works, rather than fifty attempts of which
 * some number are dead.
 */
export const SHELF_SPARE = 40;

/**
 * How far into a tag chart to start.
 *
 * Five was nowhere near enough, and the reason is written in lastfm.ts:
 * tag.getTopTracks does not report listener counts at all, so excludeHits
 * filters NOTHING on a scene, decade or place chart. Rank is the only
 * popularity signal those charts carry. Skipping five of a hundred and
 * twenty and calling it "past the greatest hits" was skipping the top
 * five songs of a scene and then serving the next hundred and fifteen in
 * order of fame - which is why a shelf keeps handing over the one track
 * by that artist everybody already knows.
 *
 * Thirty. The top thirty of a tag is the part that is on every playlist
 * about that tag, and somebody who chose to open this shelf has heard
 * them.
 */
const SKIP_TOP = 30;

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

/** Where a shelf's records came from, so the page can say the truth. */
export type ShelfSource = "youtube" | "lastfm" | "posts" | "none";

export type ShelfResult = {
  records: Sleeve[];
  source: ShelfSource;
  /** Why it is empty, when something actually went wrong. */
  failure?: SearchFailure;
};

/** Everything on one shelf, fetched. */
export async function getShelf(
  axis: AxisId,
  value: string,
  known: Known,
  rotateBy = 0
): Promise<ShelfResult> {
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
  let youtubeFailure: SearchFailure | undefined;

  // Except for the handful Last.fm cannot describe.
  //
  // digicore, sigilkore, HexD, alte and the rest did not happen on
  // scrobblers - they happened on YouTube, mostly in the last five
  // years, mostly by people who never put a record in a store. Asking
  // Last.fm for those charts returns a handful of tracks or none, which
  // draws as a shelf saying nobody makes this about a scene with more
  // releases in a week than half the tags around it.
  //
  // Those come from where the music is. One cached search a day each,
  // and the records arrive with their own artwork and their own player,
  // so they are also the only shelves where nothing has to be looked up
  // afterwards to be seen or heard. See lib/youtubeScenes.
  if (axis === "scene" && isYoutubeScene(value)) {
    const fromYoutube = await getYoutubeSceneShelf(
      tag,
      known,
      SHELF_SIZE + SHELF_SPARE,
      rotateBy,
      dayIndex()
    );
    // A quota that has run out, or a key that is not set, must not leave
    // a scene with no shelf at all - so it falls through to Last.fm,
    // which will be thin for these but is better than empty.
    if (fromYoutube.records.length > 0) {
      return { records: fromYoutube.records, source: "youtube" };
    }
    // Nothing from YouTube. Last.fm is still worth asking - it is thin
    // for these scenes rather than empty - but the reason YouTube had
    // nothing is carried on in case Last.fm has nothing either, so the
    // page can say which thing failed instead of shrugging.
    youtubeFailure = fromYoutube.failure;
  }

  // Two pages, in parallel, and the second one moves.
  //
  // One page of a tag chart is the same hundred and twenty records
  // forever, so rotating within it only ever changes where the shelf
  // STARTS - come back tomorrow and it is the same records in a
  // different order, which is what "I keep seeing the same thing" is.
  // A second page chosen by the spin is genuinely different records, and
  // it is deeper into the chart, which is where the deep cuts are.
  //
  // Costs nothing in time: two requests going out together take as long
  // as the slower one, and Last.fm answers both from the same cache
  // shelf anybody else on that tag today has already warmed.
  // How far down the chart the shelf starts.
  //
  // Widened from four pages to six. A tag chart is ordered by play count
  // and reports nothing else, so rank IS the popularity signal, and the
  // further down you go the closer you get to people nobody has heard
  // of - which is the whole request. Page 7 at 120 a page is rank 720
  // upward: still real records with real listeners, deep enough that
  // somebody browsing that shelf almost certainly has not met them.
  //
  // Safe to reach past the end of a small tag: page one is fetched
  // alongside this and backs the shelf up when the deep page is thin.
  const deepPage = 2 + (Math.abs(rotateBy) % 6);
  const [front, deeper] = await Promise.all([
    getTracksByTag(tag, 120).catch(() => []),
    getTracksByTag(tag, 120, deepPage).catch(() => []),
  ]);
  // The deeper page leads. Page one of a tag chart is that scene's
  // greatest hits however far into it you start, so a shelf built front
  // first is a shelf of the famous ones with the finds underneath. This
  // way round the finds are what you see and page one is the backstop
  // that keeps the shelf full.
  const tracks = [...deeper, ...front];
  // Fetched deeper than the shelf shows, and the extra is not padding.
  //
  // A record the catalogue has nothing for is a blank sleeve you cannot
  // play, and a wall of those is the thing that got reported. The
  // browser swaps each one out for the next record down as soon as it
  // finds out, so the tail is the supply of replacements. Costs nothing:
  // the tracks were already in the answer.
  const shelf = fillShelf(tracks, known, SHELF_SIZE + SHELF_SPARE, rotateBy);

  // Nothing is enriched here any more, and that is the whole speed fix.
  //
  // This used to look up the first twelve records' artwork and clips
  // before the page was allowed to render: twelve iTunes calls, four at
  // a time, each able to back off for two and a half seconds when Apple
  // throttles. On a cold cache that is most of a minute during which the
  // shelf shows nothing at all - not a slow shelf, a blank page.
  //
  // The browser already does this better. ShelfRecords asks only for the
  // records that scroll into view and batches them into one request, so
  // the twelve visible ones arrive together a moment after the boards
  // do, and the thirty-eight below them are never fetched unless
  // somebody scrolls. Doing it twice was not belt and braces, it was
  // paying the slow way first and the fast way second.
  if (shelf.length > 0) return { records: shelf, source: "lastfm" };
  return { records: shelf, source: "none", ...(youtubeFailure ? { failure: youtubeFailure } : {}) };
}
