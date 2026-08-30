import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaType } from "@/lib/media";
import { slugify } from "@/lib/slug";

/** The club a post belongs to, and whether this post is what started it. */
export type ClubForPost = { id: string | null; founded: boolean };

// Finds the fan club for this artist/title, creating a pending one the
// first time someone posts about it. Pending clubs aren't listed publicly
// until an admin approves them. Returns a null id if there's no name to
// key a club on (e.g. a music post with no artist filled in).
//
// `founded` says this post is the one that started the club. It used to
// be thrown away, so the site advertised "review something new and a club
// gets started" and then started one in total silence - the person who
// did it was the only one who never found out.
export async function findOrCreateClub(
  supabase: SupabaseClient,
  mediaType: MediaType,
  name: string
): Promise<ClubForPost> {
  const slug = slugify(name);
  if (!slug) return { id: null, founded: false };

  const { data: existing } = await supabase
    .from("clubs")
    .select("id")
    .eq("media_type", mediaType)
    .eq("slug", slug)
    .maybeSingle();
  if (existing) return { id: existing.id, founded: false };

  const { data: created } = await supabase
    .from("clubs")
    .insert({ media_type: mediaType, name, slug, status: "pending" })
    .select("id")
    .single();
  // A failed insert is not a founding. Reporting one would put "you
  // started the X club" on screen next to a club that doesn't exist.
  return { id: created?.id ?? null, founded: !!created?.id };
}
