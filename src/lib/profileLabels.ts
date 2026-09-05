import type { SupabaseClient } from "@supabase/supabase-js";

// Every piece of user-facing wording on a profile, in one place, editable
// from Admin -> Profile Text.
//
// The point is that disagreeing with a word should not need a deploy.
// "Greatest Hits", "Up Next", "Regulars" - all of these were decided in
// a commit message by somebody who is not the person running the site,
// and the right way to settle that argument is to hand over the keys
// rather than to keep guessing.
//
// Same storage as the theme names: site_settings, keyed
// `profile_label:<key>`. No new table, no migration. A blank value means
// "use the shipped word", which is why there is no separate reset.

export type ProfileLabelKey =
  | "reviews"
  | "highlights"
  | "collections"
  | "clubs"
  | "favorites"
  | "stats"
  | "achievements"
  | "presence"
  | "about"
  | "obsessed"
  | "twin"
  | "week"
  | "pinned"
  | "stickers"
  | "store_new"
  | "store_added"
  | "store_chart"
  | "store_artists"
  | "store_genre"
  | "store_see_all"
  | "store_all_reviews"
  | "follow";

/** The shipped wording, and the order the admin screen lists them in. */
export const PROFILE_LABELS: { key: ProfileLabelKey; label: string; hint: string }[] = [
  { key: "reviews", label: "Reviews", hint: "The list of everything they've reviewed." },
  { key: "highlights", label: "Greatest Hits", hint: "Their best-received reviews." },
  { key: "collections", label: "Collections", hint: "Lists they've put together." },
  { key: "clubs", label: "Clubs", hint: "Fan clubs they belong to." },
  { key: "favorites", label: "Favorites", hint: "Their shortlist." },
  { key: "stats", label: "By the Numbers", hint: "Review counts by category." },
  { key: "achievements", label: "Trophies", hint: "Badges they've unlocked." },
  { key: "presence", label: "Online", hint: "Last seen, joined date, profile views." },
  { key: "about", label: "Bio", hint: "Their written bio." },
  { key: "obsessed", label: "Obsessed With", hint: "The one thing they're into right now." },
  { key: "twin", label: "Taste Twin", hint: "The member whose ratings match theirs." },
  { key: "week", label: "This Week", hint: "Their last seven days." },
  { key: "pinned", label: "Pinned", hint: "Reviews they've pinned to the top." },
  { key: "stickers", label: "Stickers", hint: "The sticker hub." },
  { key: "store_new", label: "New Releases", hint: "First shelf: their most recent reviews." },
  { key: "store_added", label: "Just Added", hint: "Second shelf." },
  { key: "store_chart", label: "Top Rated", hint: "The numbered chart down the right." },
  { key: "store_artists", label: "Featured Artists", hint: "Who they review most." },
  { key: "store_genre", label: "Choose Genre", hint: "The genre menu." },
  { key: "store_see_all", label: "See All", hint: "The link at the end of every shelf." },
  { key: "store_all_reviews", label: "All Reviews", hint: "The link under the chart." },
  { key: "follow", label: "Follow", hint: "The button on somebody else's profile." },
];

export type ProfileLabels = Record<ProfileLabelKey, string>;

export const MAX_PROFILE_LABEL = 28;

export function profileLabelKey(key: ProfileLabelKey): string {
  return `profile_label:${key}`;
}

export function cleanProfileLabel(raw: unknown): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_PROFILE_LABEL);
}

export function defaultProfileLabels(): ProfileLabels {
  const out = {} as ProfileLabels;
  for (const l of PROFILE_LABELS) out[l.key] = l.label;
  return out;
}

/**
 * The live wording.
 *
 * Falls back to the shipped words on any failure. A profile with no
 * headings on it is far worse than a profile using the words that were
 * committed, so this can return partial overrides but never nothing.
 */
export async function getProfileLabels(supabase: SupabaseClient): Promise<ProfileLabels> {
  const labels = defaultProfileLabels();
  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", PROFILE_LABELS.map((l) => profileLabelKey(l.key)));
    if (error || !data) return labels;
    for (const row of data) {
      const key = String(row.key).slice("profile_label:".length) as ProfileLabelKey;
      const value = cleanProfileLabel(row.value);
      if (value && key in labels) labels[key] = value;
    }
  } catch {
    /* shipped words it is */
  }
  return labels;
}
