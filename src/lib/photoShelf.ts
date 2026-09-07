import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A shelf of photographs, shot by people here.
 *
 * The other two media come from catalogues out on the internet: Last.fm
 * knows what was tagged shoegaze and YouTube has the trailers. There is
 * no catalogue of the photographs the members of this site have taken,
 * and there was never going to be one, so a photography shelf that
 * queried outward would be a shelf of other people's pictures with our
 * name on it.
 *
 * It reads the site's own photography posts instead. That makes it the
 * one wall here that gets better as the site is used rather than as an
 * API is paid for, and it is the only version of this that is honest.
 *
 * It also means a subject with nothing behind it is genuinely empty
 * rather than broken, which the page has to be able to say - see the
 * count that comes back with it.
 */

export type Print = {
  id: string;
  title: string;
  imageUrl: string;
  /** Who took it, or who they credited. */
  by: string;
  authorUsername: string | null;
  rating: number | null;
  createdAt: string;
};

type PhotoRow = {
  id: string;
  title: string | null;
  artist: string | null;
  cover_url: string | null;
  rating: number | null;
  created_at: string;
  profiles?: { username: string | null } | { username: string | null }[] | null;
};

/** How many prints hang on one shelf. */
export const PRINTS_PER_SHELF = 36;

function usernameOf(row: PhotoRow): string | null {
  const p = row.profiles;
  if (!p) return null;
  return (Array.isArray(p) ? p[0]?.username : p.username) ?? null;
}

/**
 * The prints for one subject.
 *
 * A photography post with no picture is not a photograph, so it is not
 * on the wall - unlike a music review with no cover, which is still a
 * review of a real record and gets its artwork filled in from the
 * catalogue. There is nowhere to fill this in from.
 */
export async function getPrints(
  supabase: SupabaseClient,
  subject: string,
  limit = PRINTS_PER_SHELF
): Promise<Print[]> {
  const { data, error } = await supabase
    .from("posts")
    .select("id, title, artist, cover_url, rating, created_at, profiles(username)")
    .eq("media_type", "photography")
    .eq("genre", subject)
    .not("cover_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<PhotoRow[]>();

  // An error is not an empty subject, and the two must not look the
  // same: one means nobody has shot this yet and the other means the
  // query is broken. The page says which, so this hands back nothing
  // and lets the caller tell them apart by checking the error itself.
  if (error || !data) return [];

  return data
    .filter((row) => !!row.cover_url && !!row.title)
    .map((row) => ({
      id: row.id,
      title: row.title as string,
      imageUrl: row.cover_url as string,
      by: row.artist?.trim() || usernameOf(row) || "Unknown",
      authorUsername: usernameOf(row),
      rating: row.rating,
      createdAt: row.created_at,
    }));
}
