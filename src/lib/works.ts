import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaType } from "@/lib/media";

// The thing being reviewed, as an object in its own right.
//
// Until now there wasn't one. A review of Dune was free text, and two
// people reviewing Dune produced two unrelated rows. The feed papered
// over it with `title.trim().toLowerCase()` computed in memory over the
// last hundred posts, which had three problems worth naming, because the
// fix is the reason this file exists:
//
//   1. It ignored the category, so a film called Blue and a song called
//      Blue were the same thing.
//   2. It ignored the artist, so every song called Alright was one song.
//   3. It only existed inside one render of one page, so nothing else -
//      no average rating, no "4 people rated this", no page for the work
//      itself - could be built on it.
//
// A row per work fixes all three and gives the metadata somewhere to live
// that isn't "whichever review happened to have a picture attached".

export type Work = {
  id: string;
  mediaType: MediaType;
  title: string;
  artist: string | null;
  coverUrl: string | null;
};

export type WorkRow = {
  id: string;
  media_type: MediaType;
  work_key: string;
  title: string;
  artist: string | null;
  cover_url: string | null;
};

/**
 * The name of a thing, reduced to what two people typing it would share.
 *
 * Deliberately conservative. Merging two different works is a worse
 * failure than missing a merge: a missed merge is a page that says "1
 * review" when it could have said 2, while a false merge puts somebody's
 * review of one film under the title of another, in public, with no way
 * for them to explain it. So this normalises what is unambiguously noise
 * and stops there.
 *
 * What it removes:
 *   - case, accents, and surrounding whitespace
 *   - a trailing parenthesised qualifier: "(2021)", "(Remastered)",
 *     "[Deluxe Edition]", "(feat. Someone)" - the commonest reason two
 *     people name the same record differently
 *   - punctuation, and repeated spaces
 *
 * What it deliberately keeps:
 *   - leading "The". "The Office" and "Office" are not obviously the same
 *     programme, and guessing wrong is the expensive direction.
 *   - numbers and subtitles. "Dune" and "Dune: Part Two" are two films,
 *     and "Blade Runner 2049" is not "Blade Runner".
 */
export function normalizeName(input: string): string {
  return input
    .normalize("NFKD")
    // Combining marks, so "Beyoncé" and "Beyonce" agree.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Only a trailing bracketed qualifier, and only at the end: a
    // bracket in the middle is usually part of the name.
    .replace(/\s*[([][^()[\]]*[)\]]\s*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * The key two reviews must share to be about the same work.
 *
 * Scoped by category, always: without it a film and a song of the same
 * name become one work, which is the bug the feed's title-matching had.
 *
 * Music is keyed on artist AND title, because song titles collide
 * constantly and an album title without its artist is not an identity.
 * A music post with no artist falls back to the title alone - it is the
 * best available answer, and the alternative is a work nothing can ever
 * match. Film, TV and photography are keyed on the title: they have no
 * reliable second field on this site, since "artist" is empty for them.
 */
export function workKey(mediaType: MediaType, title: string, artist?: string | null): string {
  const name = normalizeName(title);
  if (!name) return "";
  if (mediaType === "music") {
    const by = normalizeName(artist ?? "");
    return by ? `music:${by}:${name}` : `music::${name}`;
  }
  return `${mediaType}:${name}`;
}

/**
 * Finds the work this review is about, creating it the first time.
 *
 * The same shape as findOrCreateClub, which is the pattern this codebase
 * already uses for "the first person to mention it brings it into
 * existence". Returns null when there is no usable title, rather than
 * creating a work called nothing.
 *
 * The artwork is filled in opportunistically: the first review to arrive
 * with a picture gives the work one, and later reviews don't overwrite
 * it. A work page assembled from whichever review happened to have an
 * image is exactly what having a works table is supposed to stop.
 */
export async function findOrCreateWork(
  supabase: SupabaseClient,
  mediaType: MediaType,
  title: string,
  artist: string | null,
  coverUrl: string | null
): Promise<string | null> {
  const key = workKey(mediaType, title, artist);
  if (!key) return null;

  const { data: existing } = await supabase
    .from("works")
    .select("id, cover_url")
    .eq("work_key", key)
    .maybeSingle<{ id: string; cover_url: string | null }>();

  if (existing) {
    if (!existing.cover_url && coverUrl) {
      await supabase.from("works").update({ cover_url: coverUrl }).eq("id", existing.id);
    }
    return existing.id;
  }

  const { data: created } = await supabase
    .from("works")
    .insert({
      work_key: key,
      media_type: mediaType,
      // The display name is whatever the first person typed, not the
      // normalised key: "Dune" reads better than "dune", and the key is
      // for matching rather than for reading.
      title: title.trim().slice(0, 200),
      artist: artist?.trim().slice(0, 200) || null,
      cover_url: coverUrl,
    })
    .select("id")
    .single<{ id: string }>();

  // Two people posting the same new thing at the same moment: the unique
  // index rejects the second insert, and the row it collided with is the
  // one it wanted.
  if (!created) {
    const { data: raced } = await supabase
      .from("works")
      .select("id")
      .eq("work_key", key)
      .maybeSingle<{ id: string }>();
    return raced?.id ?? null;
  }

  return created.id;
}

/** The average of the ratings that exist, and how many there were. */
export function averageRating(ratings: (number | null)[]): { average: number; count: number } {
  const given = ratings.filter((r): r is number => typeof r === "number");
  if (given.length === 0) return { average: 0, count: 0 };
  const total = given.reduce((sum, r) => sum + r, 0);
  // One decimal place: two would imply a precision that four opinions do
  // not have.
  return { average: Math.round((total / given.length) * 10) / 10, count: given.length };
}
