import type { SupabaseClient } from "@supabase/supabase-js";

// Where the stickers went.
//
// They used to be dragged loose across the profile - over the photo, the
// panels, the text - which is the single thing that made a page look
// like a 2005 profile no matter what else changed. That layer is gone.
//
// The stickers themselves are not. Every row somebody placed is still in
// profile_stickers, and throwing away things people chose and arranged
// because the arrangement was the problem would be the wrong half to
// delete. So they come back as a hub: one small panel, a tidy grid, no
// dragging. Whatever you collected, in a box, instead of over
// everything.

export type HubSticker = { id: string; imageUrl: string };

/** How many fit in a panel before it stops being small. */
export const HUB_LIMIT = 24;

export async function fetchStickerHub(
  supabase: SupabaseClient,
  userId: string
): Promise<HubSticker[]> {
  try {
    const { data, error } = await supabase
      .from("profile_stickers")
      .select("id, image_url")
      .eq("user_id", userId)
      // Oldest first: this is a collection in the order it was gathered,
      // not a feed.
      .order("created_at", { ascending: true })
      .limit(HUB_LIMIT);
    if (error || !data) return [];
    return data
      .filter((r) => typeof r.image_url === "string" && r.image_url)
      .map((r) => ({ id: r.id as string, imageUrl: r.image_url as string }));
  } catch {
    // The hub is a nicety. It must never be the reason a profile fails
    // to render.
    return [];
  }
}
