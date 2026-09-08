import { workKey } from "@/lib/taste";
import { searchVideosDetailed, type SearchFailure, type YoutubeVideo } from "@/lib/youtube";
import type { Sleeve } from "@/lib/crate";
import type { Known } from "@/lib/musicDiscovery";

// The scenes Last.fm cannot describe.
//
// Every other shelf on this site is a Last.fm tag chart, and for
// shoegaze or Detroit techno that is exactly right - decades of people
// have tagged those records. It is useless for digicore, sigilkore,
// HexD, alte and the rest. Those scenes did not happen on scrobblers.
// They happened on YouTube and SoundCloud, mostly in the last five
// years, mostly by people who never uploaded to a store at all, and
// asking Last.fm for the "digicore" chart returns a handful of records
// or nothing - which is a shelf that reads as "nobody makes this" about
// a scene with more releases a week than most of the tags around it.
//
// So these ones come from where the music actually is.
//
// The budget, which is the whole reason this is a short list rather
// than every genre: a YouTube search costs 100 units of 10,000 a day,
// shared with the film trailers. So it is ONE search per scene per day,
// cached, with the shelf rotated inside the result rather than asked
// for again - sixteen scenes is at most 1,600 units even if every one
// of them is looked at, and looking at the same shelf a hundred times
// costs the same as looking at it once.
//
// What comes back is better than a Last.fm shelf in one way that
// matters more than the source: a video carries its own thumbnail AND
// its own player. A record from here needs no Apple lookup for its
// cover and no lookup to play, so these are the cheapest shelves on the
// site as well as the only ones that work.

/** How long a scene's search is reused. One search per scene per day. */
export const SCENE_TTL_SECONDS = 24 * 60 * 60;

/**
 * The scenes that come from YouTube instead of Last.fm.
 *
 * Genre slugs, matching lib/genres. Kept deliberately small: a scene
 * belongs here only when Last.fm genuinely has nothing for it, because
 * every entry is a slice of a quota the trailers also live on.
 */
export const YOUTUBE_SCENES: ReadonlySet<string> = new Set([
  // The internet pop scenes.
  "digicore",
  "glitchcore",
  "dariacore",
  "nightcore",
  "bubblegum-bass",
  "hexd",
  // Underground rap.
  "pluggnb",
  "sigilkore",
  "drain",
  // R&B and soul, the UK lineage.
  "uk-rnb",
  "trap-soul",
  "britfunk",
  "lovers-rock",
  // Club.
  "jersey-club",
  "uk-funky",
  // African.
  "alte",
]);

export function isYoutubeScene(slug: string): boolean {
  return YOUTUBE_SCENES.has(slug);
}

/**
 * How a scene gets asked for, varied by the day.
 *
 * Same cost as asking one way forever - each of these is one search,
 * and only one of them is used on any given day - but the shelf is
 * genuinely different records tomorrow rather than the same fifty in a
 * new order. Repetition was the complaint; this is the free half of the
 * answer to it.
 */
const QUERY_SHAPES = [
  (scene: string) => `${scene}`,
  (scene: string) => `${scene} songs`,
  (scene: string) => `underground ${scene}`,
  (scene: string) => `new ${scene}`,
];

export function sceneQuery(sceneText: string, dayIndex: number): string {
  const shape = QUERY_SHAPES[Math.abs(dayIndex) % QUERY_SHAPES.length];
  return shape(sceneText);
}

/**
 * Newest first, most days. Relevance one day in four.
 *
 * This is the setting that decides whether the shelf is full of people
 * who already have an audience.
 *
 * Relevance is a popularity ranking wearing a different name. Ask
 * YouTube for "uk r&b" and it returns whoever has the views, which is
 * the same fifteen artists every time - the repetition, and the exact
 * opposite of what a shelf on a site like this is for.
 *
 * Date returns what went up this week. In a scene of this size that is
 * overwhelmingly people with a few hundred plays and no press: the
 * rappers and producers who are actually making it, rather than the ones
 * who already broke. That is the point of these shelves.
 *
 * Not every day, because a shelf that is only ever the last four days of
 * uploads has no floor under it - one quiet week and it thins out. One
 * day in four the scene's own canon comes back round, which also gives
 * somebody arriving new a way in.
 *
 * Costs nothing either way: it is the same single search, and both
 * orders are cached under their own key.
 */
export function sceneOrder(dayIndex: number): "date" | undefined {
  return Math.abs(dayIndex) % 4 === 3 ? undefined : "date";
}

// Things that are not one song.
//
// A mix, an hour of something, a compilation or a type beat all rank
// well for a scene name and none of them is a record. Left on the shelf
// they are the worst kind of wrong: a sleeve with a name that is not a
// song by an artist who is not an artist.
const NOT_A_SONG =
  /\b(mix|mixtape|playlist|compilation|megamix|full album|type beat|typebeat|reaction|tutorial|interview|documentary|live ?set|dj set|radio|hour|hours|minutes|best of|top \d+|trailer|teaser|ost|soundtrack|how to|fnf|friday night funkin|mod|gameplay|walkthrough|episode|ep\.? ?\d+|concept|expo|announcement|behind the scenes|making of)\b/i;

// The furniture uploaders put around a title.
const TITLE_NOISE =
  /\((?:[^()]*\b(?:official|video|audio|lyric|lyrics|visualizer|visualiser|hd|hq|4k|mv|m\/v|prod|prod\.|remaster|remastered|explicit|clean|slowed|reverb|sped up)\b[^()]*)\)|\[(?:[^[\]]*\b(?:official|video|audio|lyric|lyrics|visualizer|visualiser|hd|hq|4k|mv|m\/v|prod|prod\.|remaster|remastered|explicit|clean|slowed|reverb|sped up)\b[^[\]]*)\]/gi;

function tidy(value: string): string {
  return value
    .replace(TITLE_NOISE, " ")
    // Straight and curly quotes both, since uploaders use whichever.
    .replace(/["""'']/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s\-–—|:]+|[\s\-–—|:]+$/g, "")
    .trim();
}

/** A "Something - Topic" channel is that artist's auto-generated one. */
function topicArtist(channelTitle: string): string | null {
  const match = channelTitle.match(/^(.*?)\s*-\s*Topic$/i);
  return match ? tidy(match[1]) : null;
}

export type ParsedTrack = { name: string; artist: string };

/**
 * An artist and a title out of a video, or nothing.
 *
 * Nothing is a real answer and it is used often. A video called
 * "gorgeous" on a channel called "xyz" could be anything, and guessing
 * puts a record on the shelf whose artist is a channel name and whose
 * title is half a sentence - which is worse than one fewer record,
 * because it is indistinguishable from a real one until you press it.
 */
/**
 * Whether this result is plausibly about the scene that was asked for.
 *
 * A search for "hexd" returned Hex, Hexed, HEX BLOOD and Hex Girls -
 * four different acts, none of them the scene, all of them ranking
 * because the word is a prefix of their name. YouTube has no way to say
 * "this word, not words beginning with it", so it is checked here: the
 * scene's own words have to appear as WHOLE words in the title, the
 * channel or the description of what came back.
 *
 * Only applied to one-word scene names. "uk r&b" and "jersey club"
 * describe themselves; "drain" and "hexd" are the ones that collide with
 * ordinary English and with other artists' names.
 */
export function looksLikeScene(video: YoutubeVideo, sceneText: string): boolean {
  const words = sceneText.split(/\s+/).filter(Boolean);
  if (words.length !== 1) return true;
  const word = words[0].replace(/[^a-z0-9]/gi, "");
  if (word.length < 3) return true;
  const haystack = `${video.title} ${video.channelTitle}`.toLowerCase();
  return new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`, "i").test(haystack);
}

export function parseVideoTitle(video: YoutubeVideo): ParsedTrack | null {
  const raw = video.title.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  if (NOT_A_SONG.test(raw)) return null;

  const cleaned = tidy(raw);
  if (!cleaned) return null;

  // Artist "Title", which is how a lot of labels and radio channels
  // upload. Read off the RAW title, because tidy strips the quotes that
  // are the only thing marking where the title starts - so done after
  // tidy this shape is invisible and the record is thrown away.
  const quoted = raw.match(/^([^"""]{2,60}?)\s*["""]([^"""]{1,})["""]/);
  if (quoted) {
    const artist = tidy(quoted[1]);
    const name = tidy(quoted[2]);
    if (artist.length >= 2 && name.length >= 1) return { name, artist };
  }

  // "Artist - Title", the overwhelming majority. Split on the FIRST
  // separator: "Artist - Title - Something" is an artist and a title
  // with a suffix, not two artists.
  const split = cleaned.match(/^(.{1,60}?)\s+[-–—]\s+(.+)$/);
  if (split) {
    const artist = tidy(split[1]);
    const name = tidy(split[2]);
    if (artist.length >= 2 && name.length >= 1) return { name, artist };
  }

  // No separator. A Topic channel still knows who it is, which is how
  // most catalogue uploads look.
  const topic = topicArtist(video.channelTitle);
  if (topic && topic.length >= 2) return { name: cleaned, artist: topic };

  // Anything else is a title with no known artist. Left off the shelf.
  return null;
}

/**
 * A scene's shelf, from one cached search.
 *
 * `rotateBy` moves within what came back rather than asking again, so
 * flicking between shelves costs nothing at all after the first one of
 * the day.
 */
export async function getYoutubeSceneShelf(
  sceneText: string,
  known: Known,
  limit: number,
  rotateBy = 0,
  dayIndex = 0
): Promise<{ records: Sleeve[]; failure?: SearchFailure }> {
  const order = sceneOrder(dayIndex);
  const { videos, failure } = await searchVideosDetailed(sceneQuery(sceneText, dayIndex), 50, {
    revalidateSeconds: SCENE_TTL_SECONDS,
    ...(order ? { order } : {}),
    // Music only. Without this a search for a small scene returns
    // whatever shares the word, and the shelf fills with things that
    // are not records at all - see the note in lib/youtube.
    videoCategoryId: "10",
  }).catch(() => ({ videos: [] as YoutubeVideo[], failure: { reason: "network" } as SearchFailure }));
  // The reason travels with the emptiness.
  //
  // A missing key, a spent daily allowance and a scene the search
  // genuinely has nothing for are three different problems with three
  // different answers, and all three used to render as the same empty
  // board. Somebody looking at it could not tell whether to wait until
  // tomorrow, go and fix a key, or try another divider.
  if (videos.length === 0) return { records: [], failure };

  const start = videos.length ? Math.abs(rotateBy) % videos.length : 0;
  const ordered = [...videos.slice(start), ...videos.slice(0, start)];

  const seen = new Set<string>();
  const perArtist = new Map<string, number>();
  const shelf: Sleeve[] = [];
  for (const video of ordered) {
    // A one-word scene has to actually be named, not merely prefixed.
    if (!looksLikeScene(video, sceneText)) continue;
    const parsed = parseVideoTitle(video);
    if (!parsed) continue;
    const key = workKey(parsed.name, parsed.artist);
    if (seen.has(key) || known.works.has(key)) continue;
    // Three each, the same rule the Last.fm shelves use. A search for a
    // small scene comes back heavy on whoever is biggest in it, and a
    // shelf of one artist is not a shelf about a scene.
    const artistKey = parsed.artist.toLowerCase().trim();
    const already = perArtist.get(artistKey) ?? 0;
    if (already >= 3) continue;
    perArtist.set(artistKey, already + 1);
    seen.add(key);
    shelf.push({
      key,
      name: parsed.name,
      artist: parsed.artist,
      // The thumbnail IS the cover here, so nothing has to ask Apple for
      // one - and unlike an Apple lookup it cannot come back empty.
      imageUrl: video.thumbnailUrl,
      previewUrl: null,
      storeUrl: null,
      // And it plays itself. A record that arrives knowing its own video
      // needs no lookup to be heard, which makes these the only shelves
      // where every single sleeve is playable the moment it is drawn.
      videoId: video.id,
    });
    if (shelf.length >= limit) break;
  }
  return { records: shelf, failure: shelf.length === 0 ? failure : undefined };
}
