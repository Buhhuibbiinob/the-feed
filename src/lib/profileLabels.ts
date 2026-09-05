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
  | "guestbook"
  | "store_new"
  | "store_added"
  | "store_chart"
  | "store_artists"
  | "store_genre"
  | "store_see_all"
  | "store_all_reviews"
  | "store_browse_search"
  | "store_browse_discover"
  | "store_browse_clubs"
  | "store_browse_note"
  | "store_browse_all"
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
  { key: "guestbook", label: "Guestbook", hint: "Where visitors leave a note." },
  // ---- The store front ----
  // These were the 2003 Music Store's own words - New Releases, Just
  // Added, Featured Artists, Power Search - and on a shop selling
  // records to strangers they are exactly right. On one person's page
  // they are nonsense: nothing here is "released", nobody is "featured",
  // and the artists are not the shop's picks, they are whoever this
  // person keeps writing about. The layout is borrowed; the words should
  // not be.
  //
  // {name} is replaced with whose page it is, so a heading can address
  // the person rather than describing a category.
  { key: "store_new", label: "Lately", hint: "First shelf: their most recent reviews." },
  { key: "store_added", label: "{name}'s Favorites", hint: "Second shelf: the things they picked themselves." },
  { key: "store_chart", label: "Best Rated", hint: "The numbered chart down the right." },
  { key: "store_artists", label: "On Repeat", hint: "The artists they review most - worked out, not chosen." },
  { key: "store_genre", label: "Any genre", hint: "The genre filter." },
  { key: "store_see_all", label: "See all", hint: "The link at the end of every shelf." },
  { key: "store_all_reviews", label: "Every review", hint: "The link under the chart." },
  { key: "store_browse_search", label: "Search", hint: "Sidebar link to site search." },
  { key: "store_browse_discover", label: "Discover", hint: "Sidebar link to recommendations." },
  { key: "store_browse_clubs", label: "Their clubs", hint: "Sidebar link to the clubs section." },
  { key: "store_browse_note", label: "Leave a note", hint: "Sidebar link to the guestbook." },
  { key: "store_browse_all", label: "Everyone", hint: "The link under Featured Artists." },
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

/**
 * Puts whose page it is into a label.
 *
 * A profile heading can say "Kim's Favorites" where a shop can only say
 * "Selected Favorites", and that difference is most of what makes a
 * borrowed layout feel like somebody's own page. Labels without {name}
 * are returned untouched, so this costs nothing for the ones that read
 * fine on their own.
 */
export function personalise(labels: ProfileLabels, username: string): ProfileLabels {
  const out = {} as ProfileLabels;
  for (const key of Object.keys(labels) as ProfileLabelKey[]) {
    out[key] = labels[key].replace(/\{name\}/g, username);
  }
  return out;
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
