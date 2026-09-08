import type { SupabaseClient } from "@supabase/supabase-js";
import type { Sleeve } from "@/lib/crate";
import { workKey } from "@/lib/taste";

// The shelf the site can always fill.
//
// Every other source can fail. Last.fm can be down or have nothing for a
// scene it has never heard of; YouTube's allowance runs out at some
// point in the day; Apple throttles. When all of them do, a shelf headed
// UK R&B said "couldn't reach Last.fm" over an empty board - which is
// both a lie, because that shelf does not come from Last.fm, and a page
// that looks broken.
//
// This one is the records people here have actually posted about, read
// out of the site's own database. It cannot be rate limited, it cannot
// run out, and it needs no key. It is thin early on and gets better the
// more anybody uses the site, which is the right way round for a shelf
// on a site about what its members are listening to.
//
// Used as a backstop rather than a source: a real catalogue shelf is
// fifty records nobody here has heard, and that is the point of the
// wall. This fills in behind it, and takes over entirely when the
// catalogues have nothing to give.

type PostRow = {
  title: string | null;
  artist: string | null;
  cover_url: string | null;
  created_at: string;
};

/**
 * Records members have posted under this genre.
 *
 * Newest first, deduplicated, three to an artist - the same rule the
 * catalogue shelves use, for the same reason: one person's obsession is
 * not a scene.
 */
export async function getShelfFromPosts(
  supabase: SupabaseClient,
  genre: string,
  limit: number
): Promise<Sleeve[]> {
  if (limit <= 0) return [];
  const [reviewed, made] = await Promise.all([
    reviewedRecords(supabase, genre, limit),
    // The people here, first.
    //
    // A wall of UK R&B built entirely out of a catalogue, with a
    // member's own UK R&B record sitting on another page unable to get
    // on it, is the wrong way round for a site about what the people
    // here are actually making. So what members made leads, and what
    // they reviewed fills in behind it.
    ownWork(supabase, genre, limit),
  ]);
  const seen = new Set<string>();
  const out: Sleeve[] = [];
  for (const record of [...made, ...reviewed]) {
    if (seen.has(record.key)) continue;
    seen.add(record.key);
    out.push(record);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Music members here made themselves, filed under this genre.
 *
 * There is no cover and no clip: an artist_post is a link to somebody's
 * track on Spotify or SoundCloud, not a catalogue entry. It draws as a
 * printed white label with their name on it, which is what a record with
 * no sleeve art looks like and is perfectly readable - and it is a real
 * record by a real person on the shelf, which is worth more than another
 * catalogue row.
 */
async function ownWork(
  supabase: SupabaseClient,
  genre: string,
  limit: number
): Promise<Sleeve[]> {
  const { data, error } = await supabase
    .from("artist_posts")
    .select("artist_name, description, link_url, created_at")
    .eq("genre", genre)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<{ artist_name: string; description: string | null; link_url: string }[]>();
  // A missing column means migration 019 has not been run. The shelf
  // simply has no member records on it, which is how it was before.
  if (error || !data) return [];

  const seen = new Set<string>();
  const out: Sleeve[] = [];
  for (const row of data) {
    const artist = row.artist_name?.trim();
    if (!artist) continue;
    // An artist_post has no track title, only a name and a link, so the
    // description doubles as one where there is a short one. Better than
    // printing the URL at somebody.
    const name = row.description?.trim().split("\n")[0]?.slice(0, 60) || artist;
    const key = workKey(name, artist);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      name,
      artist,
      imageUrl: null,
      previewUrl: null,
      storeUrl: row.link_url,
    });
    if (out.length >= limit) break;
  }
  return out;
}

async function reviewedRecords(
  supabase: SupabaseClient,
  genre: string,
  limit: number
): Promise<Sleeve[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("title, artist, cover_url, created_at")
    .eq("media_type", "music")
    .eq("genre", genre)
    .order("created_at", { ascending: false })
    // Asked for deeper than the shelf needs, because the dedupe and the
    // three-per-artist rule both throw rows away.
    .limit(limit * 3)
    .returns<PostRow[]>();
  if (error || !data) return [];

  const seen = new Set<string>();
  const perArtist = new Map<string, number>();
  const shelf: Sleeve[] = [];
  for (const row of data) {
    const name = row.title?.trim();
    const artist = row.artist?.trim();
    if (!name || !artist) continue;
    const key = workKey(name, artist);
    if (seen.has(key)) continue;
    const artistKey = artist.toLowerCase();
    const already = perArtist.get(artistKey) ?? 0;
    if (already >= 3) continue;
    perArtist.set(artistKey, already + 1);
    seen.add(key);
    shelf.push({
      key,
      name,
      artist,
      // Whatever the post already carries. A post with no cover still
      // goes on the shelf: it draws as a printed white label, which is
      // readable and reviewable, and the lookup may find artwork for it
      // later anyway.
      imageUrl: row.cover_url,
      previewUrl: null,
      storeUrl: null,
    });
    if (shelf.length >= limit) break;
  }
  return shelf;
}
