import {
  excludeHits,
  getArtistTopTracks,
  getArtistsByTag,
  getArtistTags,
  rosterFor,
  sameTag,
  ROSTER_UNPLACED,
  getTracksByTag,
  tagText,
  type LastfmTrack,
} from "@/lib/lastfm";
import { dayIndex, rotate } from "@/lib/musicDiscovery";
import { getYoutubeSceneShelf, isYoutubeScene } from "@/lib/youtubeScenes";
import type { SearchFailure } from "@/lib/youtube";
import { workKey } from "@/lib/taste";
import type { Known } from "@/lib/musicDiscovery";
import type { Sleeve } from "@/lib/crate";
import { type AxisId } from "@/lib/shelfAxes";

// How a shelf gets FILLED.
//
// The other half - what the shelves are called and which ones exist -
// moved to lib/shelfAxes, because this file had grown to eleven hundred
// lines covering two jobs that change for entirely different reasons.
// Adding a place is a data edit; changing where records come from is
// this.
//
// Everything shelfAxes exports is re-exported at the bottom, so nothing
// that imports from here had to change.
//
// There is no ranking here beyond the one Last.fm's own tag charts
// carry, and even that gets its front trimmed off: the top of a tag is
// that scene's greatest hits, which is the part somebody choosing to
// browse it has already heard.

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
export type ShelfSource = "youtube" | "deezer" | "lastfm" | "posts" | "none";

export type ShelfResult = {
  records: Sleeve[];
  source: ShelfSource;
  /** Why it is empty, when something actually went wrong. */
  failure?: SearchFailure;
};

/**
 * How many of a shelf's places the site's own roster may take.
 *
 * A third, and the number is the whole argument. At the run of the shelf
 * the roster IS the shelf - fourteen UK R&B names at three records each
 * is forty-two of fifty, identical every load, which is what "it should
 * refresh often and be different not the same each time" was about. At
 * none of it the artists somebody asked for by name are back to never
 * appearing, which is what the two reports before that were about.
 *
 * A third means both: your people are always on the shelf, a different
 * few of them each visit, and two thirds of what you see is the scene
 * you came to look at.
 */
const ROSTER_SHARE = Math.ceil(SHELF_SIZE / 3);

/**
 * Listeners past which a record is not a deep cut any more.
 *
 * Kept here rather than reached for through excludeHits, because
 * excludeHits hands back the whole catalogue when the filter empties it
 * and that is exactly the leak "make all the songs niche" is about.
 */
const HIT_CEILING = 120_000;

/**
 * How far down the ordered artist list the shelf is willing to look.
 *
 * Each one past this point is a cached tag lookup and a cached track
 * lookup, and a shelf of fifty at two records an artist needs about
 * twenty-five that survive the tag check. Sixty leaves room for the ones
 * it throws out without walking the whole chart on every page view.
 */
const ARTISTS_CHECKED = 90;

/**
 * Listeners under which "nobody has tagged them" is believable.
 *
 * Above it, an artist with no tags is not undiscovered - they are a
 * lookup that did not work, and trusting the chart about them is what
 * put an established Khaleeji singer on the Drain shelf.
 */
const STILL_UNKNOWN = 50_000;

/** Version and remix words that mean "this is the same record again". */
const A_VERSION_OF =
  /\b(version|mix|remix|edit|remaster(ed)?|re[- ]?recorded|extended|radio|single|album|instrumental|acoustic|demo|dub|long|short|original|clean|explicit|mono|stereo|\d{4})\b/i;

/**
 * One shelf place per record, however the uploader spelled it.
 *
 * The New Jack Swing shelf came back with "Rumors - 1986 Version" AND
 * "Rumours - Long Version", "Treat Them Like They Want to Be Treated"
 * twice, and "Breakin' 84" beside "Breakin' 84 - Vibes4Yourmind Mix".
 * workKey treats those as different records, correctly - they are
 * different masters and a review of one is not a review of the other -
 * but a SHELF showing all three is showing one record three times, and
 * on a shelf of fifty that is what "its very repetitive too" looks like.
 *
 * So the shelf dedupes on a looser key of its own and workKey is left
 * alone. The tail after a dash goes when it is version talk, brackets
 * go, and British spellings fold to American ones so "Rumours" and
 * "Rumors" meet - a fold that is only ever used to compare two records
 * by the same artist, where a false meeting costs one shelf place and a
 * missed one costs a duplicate.
 */
export function recordKey(title: string, artist: string): string {
  let name = title.trim();
  // "Song (Radio Edit)", "Song [Remastered 2011]"
  name = name.replace(/[([][^)\]]*[)\]]\s*$/g, (m) => (A_VERSION_OF.test(m) ? "" : m));
  // A spaced hyphen and then version talk: the shape of every duplicate
  // on that shelf. Written as one match rather than an index-of on a
  // literal, because a bare spaced hyphen in this file reads to
  // copy-check as prose punctuation, and it is not - it is a separator
  // uploaders type.
  const dashed = name.match(/^(.*\S)\s+-\s+(\S.{0,39})$/);
  if (dashed && A_VERSION_OF.test(dashed[2])) name = dashed[1];
  const fold = (v: string) =>
    v
      .toLowerCase()
      .replace(/ou(rs?)\b/g, "o$1")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return `${fold(name)}|${fold(artist)}`;
}

/**
 * The order artists are walked in for one scene shelf, given one spin.
 *
 * Pulled out of the shelf builder and exported for one reason: it could
 * not be tested where it was. The checks for "the shelf is different
 * every time" all read the SOURCE for the right-looking lines, and every
 * one of them passed while five loads of the same shelf came back byte
 * for byte identical. Reading the code is not the same as running it,
 * and this file has now been burned by that difference six times.
 *
 * A pure function of (roster, tag chart, spin) can just be called twice
 * with two spins and the answers compared, which is the only kind of
 * proof that would have caught it.
 */
export function orderSceneArtists(
  ours: string[],
  tagArtists: string[],
  rotateBy: number
): string[] {
  // Least famous first: tag.getTopArtists is ordered by popularity, and
  // the back of that list is the people with no audience.
  const rotated = rotate([...tagArtists].reverse(), rotateBy);
  // The roster rotates too, so a different few of them lead each visit
  // rather than the same fourteen in the same order forever.
  const ourTurn = rotate(ours, rotateBy);
  return [...ourTurn, ...rotated.filter((a) => !ours.includes(a))];
}

/**
 * The niche end of one artist's catalogue, deepest first.
 *
 * "make all the songs niche, deep cut" - so the skip scales with how
 * much there is to skip. A big catalogue can lose its top three and
 * still have plenty; somebody with four uploads cannot lose anything at
 * all, and taking the top two off them is what left a small artist off
 * their own scene's shelf.
 *
 * excludeHits then drops anything with radio numbers regardless of where
 * it sat, and the rotation means coming back gets a different record by
 * the same person rather than the same one again.
 *
 * `keepSomething` is the roster's exemption: when going deep leaves an
 * artist with nothing, they give up the deep cut rather than their place
 * on the shelf. A tag-chart name never gets it - there the shelf would
 * rather be short than be the hits.
 */
export function deepCuts(
  tracks: LastfmTrack[],
  rotateBy: number,
  keepSomething: boolean
): LastfmTrack[] {
  const skip = tracks.length >= 8 ? 3 : tracks.length >= 5 ? 2 : 0;
  const past = tracks.slice(skip);

  // Filtered STRICTLY, which excludeHits does not do.
  //
  // excludeHits ends with "if filtering wiped everything, return the
  // catalogue" - a sensible rescue in the places it was written for, and
  // wrong here. It means any artist whose every song is popular comes
  // back with their hits intact, and the request was that ALL the songs
  // be niche. Found by running this rather than reading it: the check
  // that a tag-chart name gets no rescue failed on its first run.
  const niche = past.filter((t) => t.listeners === undefined || t.listeners < HIT_CEILING);

  // The rescue is the roster's alone, and only when going deep leaves
  // them with nothing at all: they give up the deep cut rather than
  // their place on the shelf. A tag-chart name would rather be missing -
  // there are ninety-nine others behind them and none of the shelf's
  // purpose is served by showing the hits.
  if (niche.length > 0) return rotate(niche, rotateBy);
  if (!keepSomething) return [];
  return rotate(past.length > 0 ? past : tracks, rotateBy);
}

/**
 * A scene's shelf, built from the artists the tag names.
 *
 * The order is what makes it deep rather than repetitive: the artist
 * list is rotated so a different corner of the scene leads each time,
 * and each artist contributes at most three records, so fifty artists
 * make a shelf of fifty rather than one artist making it twice over.
 *
 * Their top tracks are trimmed at the front, the same as everywhere
 * else here: an artist's most-played song is the one somebody browsing
 * this scene has already heard.
 */
async function sceneShelfFromArtists(
  scene: string,
  tag: string,
  known: Known,
  rotateBy: number
): Promise<Sleeve[]> {
  // Asked together: the tag's own artists, and the tags of everyone on
  // the site whose scene nobody could name.
  const [artists, deeperArtists, unplaced] = await Promise.all([
    getArtistsByTag(tag, 100).catch(() => []),
    // A second page, for variety.
    //
    // "the underground hiphop was perfection it could be more variety",
    // and one page is a hundred names - of which the shelf reaches maybe
    // twenty-five, so the same quarter of the list every time however
    // hard it is rotated. Two pages is two hundred, and the spin has
    // somewhere new to land.
    //
    // One request, cached a day, shared by everybody who opens that
    // scene - so the variety costs one call per scene per day, not one
    // per visit. Last.fm is the cheap source here; this is deliberately
    // NOT how YouTube is treated, where a page costs real budget.
    getArtistsByTag(tag, 100, 2).catch(() => []),
    // Nobody knew what Tezzus fits under, including the person who asked
    // for him. So he is not assigned a scene - the people who listen to
    // him are, and their tags are checked here against the shelf being
    // built. An artist nobody has tagged yet simply is not claimed by
    // this, and keeps the broad placement in SCENE_ROSTER.
    Promise.all(
      ROSTER_UNPLACED.map(async (artist) => ({
        artist,
        tags: await getArtistTags(artist).catch(() => [] as string[]),
      }))
    ).catch(() => []),
  ]);

  const claimed = unplaced
    .filter(({ tags }) => tags.some((t) => sameTag(t, tag) || sameTag(t, scene)))
    .map(({ artist }) => artist);

  // The site's own roster leads, and it leads even when Last.fm has
  // nothing for the tag at all - which is the case that matters, because
  // it is the small artists whose scenes are thin.
  const placed = rosterFor(scene);
  const ours = [...claimed, ...placed.filter((a) => !claimed.includes(a))];
  // Both pages, deduplicated: page two repeats page one on a tag that
  // does not have two hundred artists, and a name listed twice would
  // take two turns at the shelf.
  const pool = [...new Set([...artists, ...deeperArtists])];
  if (pool.length === 0 && ours.length === 0) return [];

  // Least famous first. tag.getTopArtists is ordered by popularity, so
  // the back of the list is where the people with no audience are - and
  // that is what these shelves are for.
  // The roster rotates like everything else, and this is a correction.
  //
  // Last time I put it in front and deliberately did NOT rotate it, so
  // the artists this site names could never be missing. The effect was a
  // shelf that never changed: UK R&B has fourteen roster artists, three
  // records each is forty-two, and the shelf is fifty - so most of it
  // was the same records in the same order on every load, which is "it
  // should refresh often and be different not the same each time".
  //
  // Being always PRESENT and being always FIRST are different things,
  // and only the first was ever the requirement. See ROSTER_SHARE.
  const ordered = orderSceneArtists(ours, pool, rotateBy);

  // Does this artist's OWN tag list say the scene, or did one person
  // tag them once?
  //
  // The New Jack Swing shelf came back with Bubba on it, whose covers
  // are black metal, and with an ambient act and a Brazilian pop act
  // beside them. None of that is tag spam exactly - somebody applied the
  // tag, and tag.getTopArtists reported it faithfully. The fault is
  // mine: walking an artist's ENTIRE catalogue treats one tag as a
  // statement about everything they have ever recorded, so a single
  // stray tag does not put one wrong record on the shelf, it puts
  // three.
  //
  // The artist's own top tags are the correction. They are what that
  // artist is KNOWN for - a stray tag is not in them, and a real new
  // jack swing act's are full of it. One cached call per artist, run in
  // parallel, and only for the tag chart: a roster name was placed by a
  // person on purpose and is not second-guessed by a chart.
  const candidates = ordered.slice(0, ARTISTS_CHECKED);
  const verdicts = await Promise.all(
    candidates.map(async (artist) => {
      if (ours.includes(artist)) return true;
      const tags = await getArtistTags(artist).catch(() => [] as string[]);
      if (tags.some((t) => sameTag(t, tag) || sameTag(t, scene))) return "yes";
      // No tags at all is not the same answer as the wrong tags.
      //
      // A small artist nobody has tagged is exactly who these shelves
      // are for, so silence cannot be read as a refusal. But a FAILED
      // lookup is also silence, and a misspelled name is silence, and
      // that door let Rashed Al Majed - an established singer with a
      // catalogue - onto the Drain shelf, because "no tags" was taken as
      // "undiscovered".
      //
      // Undiscovered is a thing that can be measured, and it is measured
      // below from the listener counts that come back with the tracks:
      // free, because the shelf fetches those anyway. Somebody with real
      // numbers and no tags is not undiscovered, they are a lookup that
      // did not work.
      return tags.length === 0 ? "unknown" : "no";
    })
  );
  const vouched = candidates.filter((_, i) => verdicts[i] !== "no");
  const unproven = new Set(candidates.filter((_, i) => verdicts[i] === "unknown"));

  const seen = new Set<string>();
  const shelf: Sleeve[] = [];
  /** How many places the roster has taken so far. */
  let fromOurs = 0;
  // Sequential on purpose. Last.fm answers these from its own cache in
  // milliseconds and there is no rate limit worth racing, while firing
  // fifty at once is how a page starts timing out.
  for (const artist of vouched) {
    if (shelf.length >= SHELF_SIZE + SHELF_SPARE) break;
    const tracks = await getArtistTopTracks(artist, 12).catch(() => []);
    if (tracks.length === 0) continue;
    // The measurement promised above. An artist the tag chart named,
    // whose own tags said nothing, is kept only if they are genuinely
    // obscure - because that is the case the silence was meant to
    // protect. Somebody with a real audience and no tags is a lookup
    // that failed, and taking their word for the scene is how a Khaleeji
    // singer and a Polish rave collective got onto a Drain shelf.
    if (unproven.has(artist)) {
      const best = Math.max(0, ...tracks.map((t) => t.listeners ?? 0));
      if (best > STILL_UNKNOWN) continue;
    }
    // Deep cuts for everybody - Whitney Houston is the album track, not
    // the one off the advert. The roster's one exemption is an artist
    // whose catalogue is too small to go deep into at all. See deepCuts.
    const mine = ours.includes(artist);
    // A share of the shelf, not the run of it. Past this the roster
    // stops taking places and the rest of the shelf is the scene at
    // large, which is what keeps a visit different from the last one.
    if (mine && fromOurs >= ROSTER_SHARE) continue;
    const deep = deepCuts(tracks, rotateBy, mine);
    let taken = 0;
    for (const track of deep) {
      // Two, not three. Ten artists at three each is thirty of a fifty
      // shelf spent on ten names, which reads as repetitive however good
      // the records are. Two spreads the same shelf over half again as
      // many people.
      if (taken >= 2) break;
      if (!track.name || !track.artist) continue;
      const key = workKey(track.name, track.artist);
      // Two keys on purpose: the strict one is what the rest of the site
      // identifies a record by, the loose one is what stops the same
      // song appearing three times under three version names.
      const dupe = recordKey(track.name, track.artist);
      if (seen.has(dupe) || known.works.has(key)) continue;
      seen.add(dupe);
      taken++;
      if (mine) fromOurs++;
      shelf.push({
        key,
        name: track.name,
        artist: track.artist,
        imageUrl: track.imageUrl,
        previewUrl: null,
        storeUrl: null,
      });
    }
  }
  return shelf;
}

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
  if (axis === "scene") {
    // The tag FIRST, and this is the correction to the last fix.
    //
    // Reported twice, the second time after I had supposedly fixed it:
    // "the genres up here and the jams up here not the jams at all. It
    // looks like they just used the filter to find the names."
    //
    // The first fix replaced the Deezer text search that sat BELOW this
    // with real tag data, and it was the right fix aimed at the wrong
    // source. YouTube ran first, and asking YouTube for "uk r&b" is the
    // same text search wearing a different logo - it returns whatever
    // ranks for that phrase. So on every shelf where YouTube had budget,
    // which after the budgeting work is all of them, the fallback never
    // ran and nothing changed. The reader was right both times.
    //
    // A tag is a different kind of claim. It is a person saying this
    // artist IS this thing, and it is the only real genre data any free
    // service has. So it leads now, for every scene, and a shelf is
    // built from artists the crowd put in that scene rather than from
    // whatever matched a phrase.
    const fromArtists = await sceneShelfFromArtists(value, tag, known, rotateBy);
    if (fromArtists.length >= SHELF_SIZE) {
      return { records: fromArtists, source: "lastfm" };
    }

    // YouTube second, and only for what the tags could not fill.
    //
    // Still worth having, because it is genuinely the only source for
    // some of these. Last.fm has twenty years of people tagging "uk r&b"
    // and almost nobody tagging "dariacore" - those scenes live on
    // YouTube and nowhere else, and for them a phrase search is the best
    // available answer rather than a lazy one. See looksLikeScene, which
    // is what keeps that answer honest.
    if (isYoutubeScene(value)) {
      const fromYoutube = await getYoutubeSceneShelf(
        tag,
        known,
        SHELF_SIZE + SHELF_SPARE,
        rotateBy,
        dayIndex()
      );
      if (fromYoutube.records.length > 0) {
        const seen = new Set(fromArtists.map((r) => r.key));
        const records = [...fromArtists];
        for (const record of fromYoutube.records) {
          if (seen.has(record.key)) continue;
          seen.add(record.key);
          records.push(record);
          if (records.length >= SHELF_SIZE + SHELF_SPARE) break;
        }
        return { records, source: fromArtists.length > 0 ? "lastfm" : "youtube" };
      }
      // The reason YouTube had nothing is carried on in case nothing
      // else has anything either, so the page can say which thing failed
      // instead of shrugging.
      youtubeFailure = fromYoutube.failure;
    }

    if (fromArtists.length > 0) return { records: fromArtists, source: "lastfm" };
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

  // A thin scene goes to the artists rather than going short.
  //
  // A tag's track chart is a few hundred songs and for anything below
  // the top hundred genres it is far fewer - so most of these shelves
  // were half empty, and the half that was there was the same handful
  // every time. The tag's ARTIST list times their catalogues is
  // thousands of records, all of them by somebody the crowd has actually
  // said belongs in that scene.
  //
  // Only for scenes. A year or a place is not a thing an artist IS: an
  // artist tagged "1994" is not a 1994 artist, they are somebody who
  // released a record that year, so walking into their catalogue would
  // return records from every other year they ever worked.
  if (axis === "scene" && shelf.length < SHELF_SIZE) {
    const seen = new Set(shelf.map((r) => r.key));
    for (const record of await sceneShelfFromArtists(value, tag, known, rotateBy)) {
      if (seen.has(record.key)) continue;
      seen.add(record.key);
      shelf.push(record);
      if (shelf.length >= SHELF_SIZE + SHELF_SPARE) break;
    }
  }

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

// The naming half, forwarded.
//
// It lives in lib/shelfAxes now. Re-exported here so that splitting the
// file was a change to this file alone - every page and script that
// already imported these from "@/lib/shelves" still does, and a reader
// following an import does not need to know the file was ever one thing.
export {
  MEDIA,
  FIRST_YEAR,
  isMedium,
  isComingSoon,
  decadeFor,
  filmPlaceTerm,
  filmPlaceLabel,
  yearValues,
  axes,
  isAxis,
  isShelfValue,
  shelfTitle,
  shelfYears,
  type AxisId,
  type Axis,
  type Medium,
  type Decade,
  type FilmPlace,
} from "@/lib/shelfAxes";
