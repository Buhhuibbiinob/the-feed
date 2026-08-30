import { createClient } from "@/lib/supabase/server";
import { isMissingSchema } from "@/lib/dbError";

/** A sticker row as the profile page reads it. */
export type StickerRow = {
  id: string;
  image_url: string;
  x: number;
  y: number;
  mobile_x: number | null;
  mobile_y: number | null;
  scale: number;
  scale_y: number | null;
  rotation: number;
  skew: number | null;
  z: number;
};

/**
 * A page's stickers, whether or not the phone-position columns exist.
 *
 * Naming a column the database doesn't have fails the ENTIRE select, and
 * the failure arrives looking exactly like "this profile has no
 * stickers". So a migration that hasn't been run yet doesn't disable one
 * unused feature - it wipes every sticker, GIF and photo off every
 * profile on the site, with nothing on screen to say why. That happened.
 *
 * The stickers are all still in the database when it does; only the read
 * fails. Falling back to the columns that have always been there means
 * the worst a missing migration can do is what it should have done all
 * along: the phone positions don't work yet, and everything else is
 * untouched.
 */
export async function fetchStickers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string
): Promise<StickerRow[]> {
  const LEGACY = "id, image_url, x, y, scale, scale_y, rotation, skew, z";
  const full = await supabase
    .from("profile_stickers")
    .select(`${LEGACY}, mobile_x, mobile_y`)
    .eq("user_id", ownerId)
    .order("z", { ascending: true })
    .returns<StickerRow[]>();
  if (!full.error) return full.data ?? [];
  if (!isMissingSchema(full.error.message)) return [];

  const legacy = await supabase
    .from("profile_stickers")
    .select(LEGACY)
    .eq("user_id", ownerId)
    .order("z", { ascending: true })
    .returns<Omit<StickerRow, "mobile_x" | "mobile_y">[]>();
  return (legacy.data ?? []).map((row) => ({ ...row, mobile_x: null, mobile_y: null }));
}
