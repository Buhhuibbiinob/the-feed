import type { SupabaseClient } from "@supabase/supabase-js";

type AnsweredRow = {
  id: string;
  title: string;
  profiles: { username: string } | { username: string }[] | null;
};

export type Answering = { id: string; title: string; username: string };

/**
 * For a set of posts, what each one is answering.
 *
 * One query for the page, keyed by the ANSWERING post's id so a card can
 * look itself up. Posts that answer nothing are simply absent from the
 * map, which is most of them.
 */
export async function loadAnswered(
  supabase: SupabaseClient,
  posts: { id: string; responds_to_post_id?: string | null }[]
): Promise<Map<string, Answering>> {
  const targets = [...new Set(posts.map((p) => p.responds_to_post_id).filter((v): v is string => !!v))];
  const out = new Map<string, Answering>();
  if (targets.length === 0) return out;

  const { data } = await supabase
    .from("posts")
    .select("id, title, profiles(username)")
    .in("id", targets)
    .returns<AnsweredRow[]>();

  const byTarget = new Map<string, Answering>();
  for (const row of data ?? []) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    byTarget.set(row.id, { id: row.id, title: row.title, username: profile?.username ?? "someone" });
  }

  // Re-keyed onto the answering post, so a card looks up by its own id
  // rather than having to know what it points at.
  for (const post of posts) {
    const target = post.responds_to_post_id ? byTarget.get(post.responds_to_post_id) : undefined;
    if (target) out.set(post.id, target);
  }
  return out;
}
