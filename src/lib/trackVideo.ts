"use client";

// Playing a record Apple has no clip for.
//
// The 30-second preview is the first choice everywhere, because it is
// free and instant and already in hand. This is the second: one YouTube
// lookup, for one record, at the moment somebody presses play on it.
//
// Never called on a schedule, on scroll, or as a lookahead. A search
// costs 100 units of a 10,000-a-day allowance shared with the film
// trailers, so the difference between "when somebody asks" and "just in
// case" is the difference between a feature and an outage.

const answers = new Map<string, string | null>();
const errors = new Map<string, string>();
/** In flight, so a double tap is one request rather than two. */
const inFlight = new Map<string, Promise<string | null>>();

export type PlayableVideo = { videoId: string | null; error: string | null };

/**
 * The video id for a song, asked for once per song per tab.
 *
 * A miss is remembered too: a record YouTube genuinely has nothing for
 * should not cost another hundred units every time somebody presses the
 * button again.
 */
export async function resolveTrackVideoId(
  key: string,
  title: string,
  artist: string
): Promise<PlayableVideo> {
  if (answers.has(key)) {
    return { videoId: answers.get(key) ?? null, error: errors.get(key) ?? null };
  }

  const existing = inFlight.get(key);
  if (existing) return { videoId: await existing, error: errors.get(key) ?? null };

  const request = (async () => {
    const params = new URLSearchParams({ title, artist });
    try {
      const res = await fetch(`/api/music/play?${params.toString()}`);
      const data = (await res.json()) as { videoId?: string | null; error?: string };
      const id = typeof data.videoId === "string" ? data.videoId : null;
      // A failure that is about the site rather than the record is NOT
      // written down as "no video". The allowance resets at midnight,
      // and remembering a quota error would keep telling somebody a
      // record is unplayable long after it stopped being true.
      if (id) answers.set(key, id);
      else if (!res.ok || !data.error) answers.set(key, null);
      if (data.error) errors.set(key, data.error);
      return id;
    } catch {
      errors.set(key, "Couldn't reach it. Try again in a moment.");
      return null;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, request);
  const videoId = await request;
  return { videoId, error: errors.get(key) ?? null };
}

/** What is already known, without asking. For rendering before a click. */
export function knownTrackVideo(key: string): PlayableVideo | null {
  if (!answers.has(key)) return null;
  return { videoId: answers.get(key) ?? null, error: errors.get(key) ?? null };
}
