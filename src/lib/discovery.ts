import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePageConfig } from "@/lib/pageConfig";
import { hasSkinChoices } from "@/lib/pageTheme";

// Profile discovery: who to show off, and in what order.
//
// The whole retention bet is that people come back to customise their
// page. So the thing worth surfacing is not the loudest reviewer, it's
// the page somebody actually built - otherwise the reward for decorating
// a profile is that nobody ever sees it.

export type DiscoverProfile = {
  /** Not rendered anywhere. Used only to keep the directory balanced. */
  isBot?: boolean;
  id: string;
  username: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  moodEmoji: string | null;
  reviewCount: number;
  lastActive: string | null;
  /** 0-10ish. How much of the page they've made their own. */
  effort: number;
};

type ProfileRow = {
  id: string;
  username: string;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  mood_emoji: string | null;
  last_seen_at: string | null;
  is_bot?: boolean;
  created_at: string;
};

type ConfigRow = { owner_id: string; config: unknown };

/**
 * Counts the deliberate choices someone has made. Each is worth one
 * point, so a page with a picture and a colour scores below one with a
 * theme, stickers, a song and a filled-in shortlist - which is the
 * ordering the carousel wants.
 */
function effortScore(profile: ProfileRow, config: unknown, stickerCount: number): number {
  let score = 0;
  if (profile.avatar_url) score++;
  if (profile.banner_url) score++;
  if (profile.bio) score++;
  if (profile.mood_emoji) score++;
  if (stickerCount > 0) score += Math.min(3, stickerCount);

  if (config) {
    const resolved = resolvePageConfig(config, "profile");
    if (resolved.themeId !== "none") score += 2;
    if (hasSkinChoices(resolved.palette)) score++;
    if (resolved.background.kind !== "none") score++;
    // Only counts as arrangement if they moved something off the default.
    if (resolved.modules.some((m) => m.column)) score++;
  }

  return score;
}

export async function getDiscoverProfiles(
  supabase: SupabaseClient,
  { limit = 60 }: { limit?: number } = {}
): Promise<DiscoverProfile[]> {
  const [{ data: profileRows }, { data: configRows }, { data: postRows }, { data: stickerRows }] =
    await Promise.all([
      // Bots are in the directory now, unlabelled, the same as they are
      // in the feed. They are capped further down rather than here: the
      // query has to see them all before it can decide which to keep.
      supabase
        .from("profiles")
        .select("id, username, avatar_url, banner_url, bio, mood_emoji, last_seen_at, created_at, is_bot")
        .eq("banned", false)
        .limit(limit * 3)
        .returns<ProfileRow[]>(),
      supabase
        .from("page_configs")
        .select("owner_id, config")
        .eq("owner_type", "profile")
        .returns<ConfigRow[]>(),
      supabase.from("posts").select("user_id"),
      supabase.from("profile_stickers").select("user_id"),
    ]);

  const configByUser = new Map((configRows ?? []).map((r) => [r.owner_id, r.config]));

  const reviewCounts = new Map<string, number>();
  for (const row of postRows ?? []) {
    reviewCounts.set(row.user_id, (reviewCounts.get(row.user_id) ?? 0) + 1);
  }

  const stickerCounts = new Map<string, number>();
  for (const row of stickerRows ?? []) {
    stickerCounts.set(row.user_id, (stickerCounts.get(row.user_id) ?? 0) + 1);
  }

  const all = (profileRows ?? []).map((profile) => ({
    id: profile.id,
    username: profile.username,
    avatarUrl: profile.avatar_url,
    bannerUrl: profile.banner_url,
    bio: profile.bio,
    moodEmoji: profile.mood_emoji,
    reviewCount: reviewCounts.get(profile.id) ?? 0,
    lastActive: profile.last_seen_at,
    effort: effortScore(profile, configByUser.get(profile.id), stickerCounts.get(profile.id) ?? 0),
    isBot: profile.is_bot === true,
  }));

  // Every real member, then at most as many bots as there are members.
  //
  // Uncapped, bots would own this page: they post constantly, so they win
  // the Most reviews and Recently active sorts outright, and there are
  // more of them than there are people. A directory where a member scrolls
  // past thirty strangers before reaching anyone who will ever reply does
  // the opposite of making the place feel worth posting in - which is the
  // entire reason the bots exist.
  //
  // The cap is a ratio rather than a number, so it widens on its own as
  // real membership grows.
  const people = all.filter((p) => !p.isBot);
  const bots = all.filter((p) => p.isBot).slice(0, Math.max(4, people.length));
  return [...people, ...bots].slice(0, limit);
}

export type DirectorySort = "customized" | "active" | "reviews" | "new";

export const DIRECTORY_SORTS: { id: DirectorySort; label: string }[] = [
  { id: "customized", label: "Best decorated" },
  { id: "active", label: "Recently active" },
  { id: "reviews", label: "Most reviews" },
  { id: "new", label: "Newest" },
];

export function isDirectorySort(value: unknown): value is DirectorySort {
  return typeof value === "string" && DIRECTORY_SORTS.some((s) => s.id === value);
}

export function sortProfiles(
  profiles: DiscoverProfile[],
  sort: DirectorySort,
  joinedAt: Map<string, string>
): DiscoverProfile[] {
  const time = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : 0);
  const copy = [...profiles];

  switch (sort) {
    case "active":
      return copy.sort((a, b) => time(b.lastActive) - time(a.lastActive));
    case "reviews":
      return copy.sort((a, b) => b.reviewCount - a.reviewCount);
    case "new":
      return copy.sort((a, b) => time(joinedAt.get(b.id)) - time(joinedAt.get(a.id)));
    case "customized":
    default:
      // Recency breaks ties, so the front of the directory still moves
      // between visits rather than being the same six pages forever.
      return copy.sort((a, b) => b.effort - a.effort || time(b.lastActive) - time(a.lastActive));
  }
}

/**
 * One profile to feature. Picked from the best-decorated, rotated daily
 * so it isn't the same person indefinitely, and stable within a day so it
 * doesn't change under someone mid-visit.
 */
export function profileOfTheWeek(
  profiles: DiscoverProfile[],
  now: Date = new Date()
): DiscoverProfile | null {
  const candidates = profiles.filter((p) => p.effort >= 3);
  if (candidates.length === 0) return null;

  const ranked = [...candidates].sort((a, b) => b.effort - a.effort).slice(0, 10);
  const dayIndex = Math.floor(now.getTime() / (24 * 60 * 60 * 1000));
  return ranked[dayIndex % ranked.length];
}
