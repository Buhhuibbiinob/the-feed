import { lookupItunesTrack, type ItunesTrackInfo } from "@/lib/itunes";
import { lookupDeezerTrack } from "@/lib/deezer";
import { lookupSpotifyTrack } from "@/lib/spotify";

// Two catalogues, asked in the order that keeps the site working.
//
// Apple first, because it is the one that knows release years, and the
// shelves use the year to decide whether a record belongs on a decade
// and what object to draw it as. Deezer second, because it allows
// roughly thirty times as many requests and has most of what Apple has
// plus a good deal of what it does not.
//
// The interesting part is what happens when Apple says no.
//
// Apple answers 403 when asked too often, and lookupItunesTrack backs
// off and tries again twice before giving up - which is right for one
// record and ruinous for a batch of twenty four, because the throttle
// does not clear in the two seconds the batch has. Every record then
// costs three refused requests and several seconds of waiting, and
// comes back with nothing anyway. That is the shelf that never
// finishes loading.
//
// So the first 403 flips the whole process over. For the next stretch,
// Apple is not asked at all and everything goes straight to Deezer,
// which is not throttled and answers immediately. The shelf fills.
// After the window passes Apple is tried again, because it is the one
// with the years.

/** How long Apple is left alone after it refuses. */
const COOLDOWN_MS = 45_000;

/**
 * When Apple last said no.
 *
 * Module level, so one throttled lookup spares every other lookup in the
 * same server process from walking into the same wall. Not persisted:
 * this is about the next few seconds, not the next few days, and a
 * process that has just started should find out for itself.
 */
let applyBusyUntil = 0;

export function appleIsBusy(now = Date.now()): boolean {
  return now < applyBusyUntil;
}

/** Called when Apple refuses, so the rest of the batch skips it. */
export function noteAppleThrottled(now = Date.now()): void {
  applyBusyUntil = now + COOLDOWN_MS;
}

/** Only for tests: forget that Apple was ever busy. */
export function resetAppleBusy(): void {
  applyBusyUntil = 0;
}

function hasSomething(info: ItunesTrackInfo): boolean {
  return !!info.artworkUrl || !!info.previewUrl;
}

/**
 * Art, a clip and a year for one track, from whichever catalogue has it.
 *
 * The returned `throttled` means BOTH refused - which is much rarer than
 * Apple alone refusing, and is the only case where a caller should still
 * treat the answer as "ask again later" rather than as a fact about the
 * record.
 */
export async function lookupTrack(
  trackName: string,
  artistName: string,
  { deep = true, needYear = false }: { deep?: boolean; needYear?: boolean } = {}
): Promise<ItunesTrackInfo> {
  const found = await findTrack(trackName, artistName, { deep });

  // The year, and only when a shelf is actually going to check it.
  //
  // This is what puts records in the right spot. A shelf headed 1994 or
  // The 90s checks each record against its own years, and a record with
  // no year has to be allowed to stay - unknown is not wrong, and
  // dropping unknowns would empty a shelf the moment the lookups started
  // failing. So an unknown year is a record that can neither be put in
  // the wrong place nor kept out of it, and until now everything Deezer
  // rescued was unknown.
  //
  // Spotify is the one catalogue that answers this cheaply: its search
  // carries the album's release date, and it takes the EARLIEST matching
  // release rather than the top hit, so a record is dated by its
  // original press and not by whichever anniversary edition ranks best.
  //
  // Asked for only on the two axes that claim a span, because on a scene
  // or a place shelf the year is not used for anything and the request
  // would be spent on nothing.
  if (needYear && found.year === null && (found.artworkUrl || found.previewUrl)) {
    const spotify = await lookupSpotifyTrack(trackName, artistName);
    if (spotify.year !== null) return { ...found, year: spotify.year };
  }
  return found;
}

/** The art and the clip, from whichever of the two has them. */
async function findTrack(
  trackName: string,
  artistName: string,
  { deep = true }: { deep?: boolean } = {}
): Promise<ItunesTrackInfo> {
  // Apple, unless it has just refused somebody else.
  if (!appleIsBusy()) {
    const apple = await lookupItunesTrack(trackName, artistName, { deep }).catch(() => null);
    if (apple?.throttled) {
      noteAppleThrottled();
    } else if (apple && hasSomething(apple)) {
      return apple;
    } else if (apple && deep) {
      // A deep lookup that came back empty really did ask properly, so
      // Apple does not have it. Deezer might, and often does - it is
      // stronger outside the English-language catalogue, which is most
      // of what this site is about.
      const deezer = await lookupDeezerTrack(trackName, artistName);
      return hasSomething(deezer) ? deezer : apple;
    } else if (apple) {
      // A shallow miss is not proof of anything, but Deezer is cheap
      // enough to ask anyway - its rate limit is not the one under
      // pressure.
      const deezer = await lookupDeezerTrack(trackName, artistName);
      if (hasSomething(deezer)) return deezer;
      return apple;
    }
  }

  const deezer = await lookupDeezerTrack(trackName, artistName);
  if (hasSomething(deezer)) return deezer;

  // Third and last for artwork: Spotify. It has no clip to give - the
  // preview field is gone for newly registered apps, so relying on it
  // would mean a play button that works or does not depending on when
  // somebody registered the app - but a cover and a year are worth
  // having, and a sleeve with a picture on it is a record somebody will
  // look at twice.
  const spotify = await lookupSpotifyTrack(trackName, artistName);
  if (spotify.artworkUrl) {
    return {
      artworkUrl: spotify.artworkUrl,
      previewUrl: null,
      trackUrl: spotify.trackUrl,
      year: spotify.year,
    };
  }

  // Nothing anywhere. Reported as throttled only if Apple was the reason
  // it was not properly asked, so a caller can tell "we could not ask"
  // from "there is nothing there" - the distinction this whole area
  // keeps getting wrong.
  return {
    artworkUrl: null,
    previewUrl: null,
    trackUrl: null,
    year: null,
    ...(appleIsBusy() ? { throttled: true } : {}),
  };
}
