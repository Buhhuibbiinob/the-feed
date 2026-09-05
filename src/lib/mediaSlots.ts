import type { SupabaseClient } from "@supabase/supabase-js";
import type { StoreItem } from "@/lib/profileStore";

// The six boxes on a profile, and who decides what is in them.
//
// Three banners across the top, three tiles along the bottom. Each one
// holds either a picture the member chose or a music video that plays.
// A slot nobody has filled falls back to whatever the store worked out
// on its own, so a new profile still looks finished and an old one only
// changes where somebody meant it to.

export const HERO_SLOTS_RANGE = [0, 1, 2] as const;
export const PROMO_SLOTS_RANGE = [3, 4, 5] as const;
export const ALL_SLOTS = [0, 1, 2, 3, 4, 5] as const;
export type SlotIndex = (typeof ALL_SLOTS)[number];

export type MediaSlot = {
  slot: SlotIndex;
  kind: "image" | "video";
  imageUrl: string | null;
  youtubeId: string | null;
  title: string | null;
  subtitle: string | null;
  linkUrl: string | null;
};

export function isSlotIndex(value: unknown): value is SlotIndex {
  return typeof value === "number" && ALL_SLOTS.includes(value as SlotIndex);
}

/**
 * A YouTube id out of whatever somebody pasted.
 *
 * People paste the watch URL, the share URL, or the id. All three should
 * work, because telling somebody their link is wrong when you can plainly
 * see the video in it is just rude.
 */
export function parseYoutubeId(raw: unknown): string | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  if (/^[\w-]{11}$/.test(text)) return text;
  const patterns = [
    /[?&]v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];
  for (const pattern of patterns) {
    const found = text.match(pattern);
    if (found) return found[1];
  }
  return null;
}

/**
 * What each of the six boxes should show.
 *
 * `automatic` is what the store derived; the member's slots win over it
 * one box at a time. Returning a fixed-length array keeps the layout
 * stable - six holes, always six answers, some of them null.
 */
export function resolveSlots(
  slots: MediaSlot[],
  automatic: (StoreItem | null)[]
): (MediaSlot | StoreItem | null)[] {
  const byIndex = new Map(slots.map((s) => [s.slot, s]));
  return ALL_SLOTS.map((i) => byIndex.get(i) ?? automatic[i] ?? null);
}

export function isMediaSlot(value: MediaSlot | StoreItem | null): value is MediaSlot {
  return !!value && "kind" in value;
}

/** Never throws, and never blocks a profile from rendering. */
export async function fetchMediaSlots(
  supabase: SupabaseClient,
  userId: string
): Promise<MediaSlot[]> {
  try {
    const { data, error } = await supabase
      .from("profile_media_slots")
      .select("slot, kind, image_url, youtube_id, title, subtitle, link_url")
      .eq("user_id", userId);
    // A missing table means migration 011 has not been run yet. The
    // boxes keep their automatic contents, which is exactly what they
    // showed before this existed.
    if (error || !data) return [];
    return data
      .filter((r) => isSlotIndex(r.slot))
      .map((r) => ({
        slot: r.slot as SlotIndex,
        kind: r.kind === "video" ? "video" : "image",
        imageUrl: (r.image_url as string) ?? null,
        youtubeId: (r.youtube_id as string) ?? null,
        title: (r.title as string) ?? null,
        subtitle: (r.subtitle as string) ?? null,
        linkUrl: (r.link_url as string) ?? null,
      }));
  } catch {
    return [];
  }
}
