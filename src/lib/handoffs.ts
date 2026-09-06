import type { SupabaseClient } from "@supabase/supabase-js";

// Handing somebody a record.
//
// Every other way to find music on this site is a machine. The rails
// walk a similarity graph, the Crate shuffles, the Shelves sort by tag.
// This one is a person: you pick one record, one member, and say why.
//
// On a site with thirteen people that is by far the strongest signal
// available - "Sam thought of me when they heard this" beats any
// similarity score - and it was the only one with nowhere to go.

/** A note long enough to say why, short enough that it is not a review. */
export const MAX_NOTE = 280;

export type Handoff = {
  id: string;
  postId: string;
  postTitle: string;
  postArtist: string | null;
  coverUrl: string | null;
  note: string | null;
  createdAt: string;
  seenAt: string | null;
  keptAt: string | null;
  /** Who handed it over. */
  fromUsername: string;
  fromAvatarUrl: string | null;
};

type ProfileRef = { username: string; avatar_url: string | null };
type PostRef = { id: string; title: string; artist: string | null; cover_url: string | null };

type HandoffRow = {
  id: string;
  note: string | null;
  created_at: string;
  seen_at: string | null;
  kept_at: string | null;
  // Supabase returns an embedded row as an object, but types it as
  // either - so both shapes are handled rather than cast away.
  profiles: ProfileRef | ProfileRef[] | null;
  posts: PostRef | PostRef[] | null;
};

function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

/** Trims a note to something sayable. Empty means no note, not "". */
export function cleanNote(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const note = raw.trim().slice(0, MAX_NOTE);
  return note.length > 0 ? note : null;
}

/**
 * What has been handed to somebody.
 *
 * Kept ones stay in the list rather than disappearing: "you took this
 * one" is the end of a small story, and a list that empties as you use
 * it never gets to tell it.
 */
export async function getHandoffsTo(
  supabase: SupabaseClient,
  userId: string,
  limit = 30
): Promise<Handoff[]> {
  const { data } = await supabase
    .from("handoffs")
    .select(
      "id, note, created_at, seen_at, kept_at, profiles!handoffs_from_user_id_fkey(username, avatar_url), posts(id, title, artist, cover_url)"
    )
    .eq("to_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<HandoffRow[]>();

  return (data ?? []).flatMap((row) => {
    const from = one(row.profiles);
    const post = one(row.posts);
    // A handoff whose review was deleted has nothing left to hand over.
    // The row goes with it on cascade, so this only guards the window
    // between the two.
    if (!from || !post) return [];
    return [
      {
        id: row.id,
        postId: post.id,
        postTitle: post.title,
        postArtist: post.artist,
        coverUrl: post.cover_url,
        note: row.note,
        createdAt: row.created_at,
        seenAt: row.seen_at,
        keptAt: row.kept_at,
        fromUsername: from.username,
        fromAvatarUrl: from.avatar_url,
      },
    ];
  });
}

/** How many are waiting, for the badge. */
export async function countUnseenHandoffs(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { count } = await supabase
    .from("handoffs")
    .select("id", { count: "exact", head: true })
    .eq("to_user_id", userId)
    .is("seen_at", null);
  return count ?? 0;
}

export type HandCandidate = { id: string; username: string; avatarUrl: string | null };

/**
 * Who somebody can hand a record to.
 *
 * Everyone but themselves and the review's author - handing a review
 * back to the person who wrote it is the one case that is definitely
 * not a recommendation. Bots are excluded: they will never listen to
 * it, and a list of names where half of them are not people makes the
 * gesture feel like posting rather than telling someone.
 */
export async function getHandCandidates(
  supabase: SupabaseClient,
  viewerId: string,
  authorId: string
): Promise<HandCandidate[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, is_bot")
    .eq("banned", false)
    .order("username")
    .returns<{ id: string; username: string; avatar_url: string | null; is_bot: boolean | null }[]>();

  return (data ?? [])
    .filter((row) => row.id !== viewerId && row.id !== authorId && row.is_bot !== true)
    .map((row) => ({ id: row.id, username: row.username, avatarUrl: row.avatar_url }));
}
