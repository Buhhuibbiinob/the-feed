import type { SupabaseClient } from "@supabase/supabase-js";

export const SITE_CONTENT_FIELDS = [
  {
    key: "feed_heading",
    label: "Feed page heading",
    path: "/",
    default: "The Feed",
  },
  {
    key: "feed_tagline",
    label: "Feed page tagline",
    path: "/",
    default: "Share what you're watching, reading, and listening to.",
  },
  {
    key: "artists_heading",
    label: "Creators page heading",
    path: "/artists",
    default: "Underground Creators",
  },
  {
    key: "artists_tagline",
    label: "Creators page tagline",
    path: "/artists",
    default:
      "A space for unsigned artists and independent filmmakers to share their work — drop a Spotify, SoundCloud, Apple Music, or YouTube link (short films, music videos, anything you've made or directed) and let people reply. Verified creators get a blue check after admin review.",
  },
  {
    key: "artists_empty",
    label: "Creators page empty state",
    path: "/artists",
    default: "No posts yet — be the first to share your music or film.",
  },
  {
    key: "clubs_heading",
    label: "Clubs page heading",
    path: "/clubs",
    default: "Fan Clubs",
  },
  {
    key: "clubs_tagline",
    label: "Clubs page tagline",
    path: "/clubs",
    default:
      "A new club is proposed the first time someone posts about an artist, movie, or show, then reviewed by an admin before it's listed here.",
  },
  {
    key: "clubs_empty",
    label: "Clubs page empty state",
    path: "/clubs",
    default: "No clubs yet — post a review and one will be proposed automatically.",
  },
  {
    key: "chat_heading",
    label: "Chat page heading",
    path: "/chat",
    default: "Live Chat",
  },
  {
    key: "chat_tagline",
    label: "Chat page tagline",
    path: "/chat",
    default: "Based on what the community's into right now.",
  },
  {
    key: "collections_heading",
    label: "Collections page heading",
    path: "/collections",
    default: "Collections",
  },
  {
    key: "collections_tagline",
    label: "Collections page tagline",
    path: "/collections",
    default: "Curated lists of reviews, made by the community.",
  },
  {
    key: "collections_empty",
    label: "Collections page empty state",
    path: "/collections",
    default: "No collections yet — start one above.",
  },
] as const;

export type SiteContentKey = (typeof SITE_CONTENT_FIELDS)[number]["key"];

export async function getSiteText(supabase: SupabaseClient, key: SiteContentKey): Promise<string> {
  const field = SITE_CONTENT_FIELDS.find((f) => f.key === key)!;
  const { data } = await supabase.from("site_content").select("value").eq("key", key).maybeSingle();
  return data?.value || field.default;
}

export async function getAllSiteText(supabase: SupabaseClient): Promise<Record<SiteContentKey, string>> {
  const { data } = await supabase.from("site_content").select("key, value");
  const byKey = new Map((data ?? []).map((row) => [row.key, row.value as string]));
  const result = {} as Record<SiteContentKey, string>;
  for (const field of SITE_CONTENT_FIELDS) {
    result[field.key] = byKey.get(field.key) || field.default;
  }
  return result;
}
