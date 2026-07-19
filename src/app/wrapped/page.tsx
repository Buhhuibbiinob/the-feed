import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { coverGradient } from "@/lib/cover";
import { MEDIA_LABELS, type MediaType } from "@/lib/media";

type PostRow = {
  id: string;
  media_type: MediaType;
  title: string;
  artist: string | null;
  cover_url: string | null;
  rating: number | null;
  created_at: string;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const metadata = { title: "Wrapped — the feed" };

export default async function WrappedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="panel">
        <div className="panel-head">Wrapped</div>
        <div className="panel-body">
          <p>
            <Link href="/sign-in">Sign in</Link> to see your personal Wrapped recap.
          </p>
        </div>
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01T00:00:00.000Z`;

  const [{ data: posts }, { data: likeRows }, { data: commentRows }] = await Promise.all([
    supabase
      .from("posts")
      .select("id, media_type, title, artist, cover_url, rating, created_at")
      .eq("user_id", user.id)
      .gte("created_at", yearStart)
      .returns<PostRow[]>(),
    supabase.from("likes").select("post_id"),
    supabase.from("comments").select("post_id"),
  ]);

  const myPosts = posts ?? [];
  const myPostIds = new Set(myPosts.map((p) => p.id));

  const likeCounts = new Map<string, number>();
  for (const like of likeRows ?? []) {
    if (myPostIds.has(like.post_id)) likeCounts.set(like.post_id, (likeCounts.get(like.post_id) ?? 0) + 1);
  }
  const commentCounts = new Map<string, number>();
  for (const c of commentRows ?? []) {
    if (myPostIds.has(c.post_id)) commentCounts.set(c.post_id, (commentCounts.get(c.post_id) ?? 0) + 1);
  }

  const totalLikes = [...likeCounts.values()].reduce((a, b) => a + b, 0);
  const totalComments = [...commentCounts.values()].reduce((a, b) => a + b, 0);

  const breakdown = new Map<string, number>();
  const monthCounts = new Map<number, number>();
  for (const p of myPosts) {
    breakdown.set(p.media_type, (breakdown.get(p.media_type) ?? 0) + 1);
    const m = new Date(p.created_at).getMonth();
    monthCounts.set(m, (monthCounts.get(m) ?? 0) + 1);
  }
  const favoriteType = [...breakdown.entries()].sort((a, b) => b[1] - a[1])[0];
  const busiestMonth = [...monthCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  const topPost = [...myPosts].sort((a, b) => {
    const likeDiff = (likeCounts.get(b.id) ?? 0) - (likeCounts.get(a.id) ?? 0);
    return likeDiff !== 0 ? likeDiff : (b.rating ?? 0) - (a.rating ?? 0);
  })[0];

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          {profile?.username ?? "Your"} Wrapped {year}
        </div>
        <div className="panel-body">
          {myPosts.length === 0 ? (
            <div className="empty-state">
              No reviews yet in {year} — post something and check back for your Wrapped recap.
            </div>
          ) : (
            <div className="wrapped-stats">
              <div className="wrapped-stat">
                <div className="wrapped-num">{myPosts.length}</div>
                <div className="wrapped-label">reviews posted</div>
              </div>
              <div className="wrapped-stat">
                <div className="wrapped-num">{totalLikes}</div>
                <div className="wrapped-label">likes received</div>
              </div>
              <div className="wrapped-stat">
                <div className="wrapped-num">{totalComments}</div>
                <div className="wrapped-label">comments received</div>
              </div>
              {favoriteType && (
                <div className="wrapped-stat">
                  <div className="wrapped-num wrapped-cap">{MEDIA_LABELS[favoriteType[0] as MediaType]}</div>
                  <div className="wrapped-label">favorite category · {favoriteType[1]} reviews</div>
                </div>
              )}
              {busiestMonth && (
                <div className="wrapped-stat">
                  <div className="wrapped-num">{MONTHS[busiestMonth[0]]}</div>
                  <div className="wrapped-label">busiest month · {busiestMonth[1]} reviews</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {topPost && (
        <div className="panel">
          <div className="panel-head">Your Top Review</div>
          <div className="panel-body">
            <div className="wrapped-top-post">
              <div
                className="wrapped-top-cover"
                style={{
                  backgroundImage: topPost.cover_url ? `url(${topPost.cover_url})` : coverGradient(topPost.id),
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div>
                <b>{topPost.title}</b>
                {topPost.artist && <div className="sub">{topPost.artist}</div>}
                <div className="sub">
                  {likeCounts.get(topPost.id) ?? 0} likes · {commentCounts.get(topPost.id) ?? 0} comments
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
