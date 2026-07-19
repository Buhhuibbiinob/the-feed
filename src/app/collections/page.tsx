import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createCollection } from "@/app/actions/collections";
import { getAllSiteText } from "@/lib/siteContent";

type CollectionRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  profiles: { username: string } | null;
};

export const metadata = { title: "Collections — the feed" };

export default async function CollectionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: collectionRows }, { data: postRows }, siteText] = await Promise.all([
    supabase
      .from("collections")
      .select("id, user_id, name, description, created_at, profiles!collections_user_id_fkey(username)")
      .order("created_at", { ascending: false })
      .returns<CollectionRow[]>(),
    supabase.from("collection_posts").select("collection_id"),
    getAllSiteText(supabase),
  ]);

  const collections = collectionRows ?? [];

  const postCounts = new Map<string, number>();
  for (const row of postRows ?? []) {
    postCounts.set(row.collection_id, (postCounts.get(row.collection_id) ?? 0) + 1);
  }

  return (
    <>
      <div className="page-header">
        <h1>{siteText.collections_heading}</h1>
        <div className="tagline">{siteText.collections_tagline}</div>
      </div>

      {user && (
        <div className="panel">
          <div className="panel-head">New Collection</div>
          <div className="panel-body">
            <form action={createCollection} className="comment-form">
              <input name="name" placeholder="Collection name…" required />
              <textarea name="description" placeholder="What's this collection about? (optional)" />
              <div className="form-actions">
                <button className="btn" type="submit">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">All Collections</div>
        <div className="panel-body flush">
          {collections.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>{siteText.collections_empty}</div>
          ) : (
            collections.map((c) => (
              <Link href={`/collections/${c.id}`} className="club-row" key={c.id}>
                <span className="club-row-name">{c.name}</span>
                <span className="club-row-members">
                  {postCounts.get(c.id) ?? 0} post{(postCounts.get(c.id) ?? 0) === 1 ? "" : "s"}
                </span>
                <span className="club-row-members">by {c.profiles?.username ?? "unknown"}</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  );
}
