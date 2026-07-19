import type { SupabaseClient } from "@supabase/supabase-js";
import type { MediaType } from "@/lib/media";
import { slugify } from "@/lib/slug";

// Finds the fan club for this artist/title, auto-creating it the first time
// someone posts about it. Returns null if there's no name to key a club on
// (e.g. a music post with no artist filled in).
export async function findOrCreateClub(
  supabase: SupabaseClient,
  mediaType: MediaType,
  name: string
): Promise<string | null> {
  const slug = slugify(name);
  if (!slug) return null;

  const { data: existing } = await supabase
    .from("clubs")
    .select("id")
    .eq("media_type", mediaType)
    .eq("slug", slug)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created } = await supabase
    .from("clubs")
    .insert({ media_type: mediaType, name, slug })
    .select("id")
    .single();
  return created?.id ?? null;
}
