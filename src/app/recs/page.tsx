import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { FindRail } from "@/components/FindRail";
import {
  alreadyKnown,
  communitySeeds,
  describeDiscoveryStatus,
  discoveryStatus,
  enrichFinds,
  eraFinds,
  findsForSeeds,
  sceneFinds,
  seedArtists,
  type SeedPost,
} from "@/lib/musicDiscovery";
import { selectPosts } from "@/lib/postQuery";
import { PostCard, type PostCardData } from "@/components/PostCard";
import { OrbyBot } from "@/components/OrbyBot";
import type { MediaType } from "@/lib/media";
import { guardBuiltinPage } from "@/lib/pages";

type PostRow = {
  id: string;
  user_id: string;
  media_type: MediaType;
  genre: string | null;
  title: string;
  body: string;
  rating: number | null;
  created_at: string;
  artist: string | null;
  cover_url: string | null;
  spotify_track_id: string | null;
  youtube_video_id: string | null;
  profiles: { username: string } | null;
};

export const metadata = { title: "Recs - Feedback" };

function toCardData(post: PostRow): PostCardData {
  return {
    id: post.id,
    userId: post.user_id,
    mediaType: post.media_type,
    title: post.title,
    body: post.body,
    rating: post.rating,
    createdAt: post.created_at,
    artist: post.artist,
    coverUrl: post.cover_url,
    genre: post.genre,
    spotifyTrackId: post.spotify_track_id,
    youtubeVideoId: post.youtube_video_id,
    username: post.profiles?.username ?? "unknown",
  };
}

export default async function RecsPage() {
  const supabase = await createClient();
  await guardBuiltinPage(supabase, "recs");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Moderation follows the moderator. An admin who can remove a post from
  // the feed but not from the page they actually found it on has to go
  // and find it again somewhere else first.
  const viewerIsAdmin = user ? await isAdmin(supabase, user.id) : false;

  const [posts, { data: likeRows }, { data: commentRows }] = await Promise.all([
    selectPosts<PostRow>(
      (columns) =>
        supabase
          .from("posts")
          .select(`${columns}, profiles!posts_user_id_fkey(username)`)
          .order("created_at", { ascending: false })
          .limit(200)
          .returns<PostRow[]>(),
      "id, user_id, media_type, title, body, rating, created_at, artist, cover_url, spotify_track_id, youtube_video_id, genre"
    ),
    supabase.from("likes").select("post_id, user_id"),
    supabase.from("comments").select("post_id"),
  ]);

  const allPosts = posts ?? [];

  const likeCounts = new Map<string, number>();
  const likedByMe = new Set<string>();
  for (const like of likeRows ?? []) {
    likeCounts.set(like.post_id, (likeCounts.get(like.post_id) ?? 0) + 1);
    if (user && like.user_id === user.id) likedByMe.add(like.post_id);
  }
  const commentCounts = new Map<string, number>();
  for (const comment of commentRows ?? []) {
    commentCounts.set(comment.post_id, (commentCounts.get(comment.post_id) ?? 0) + 1);
  }


  const trending = allPosts
    .filter((p) => p.user_id !== user?.id)
    .map((post) => ({
      post,
      score: (likeCounts.get(post.id) ?? 0) * 2 + (commentCounts.get(post.id) ?? 0) + (post.rating ?? 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((x) => x.post);

  let forYou: PostRow[] = [];
  if (user) {
    const [{ data: myPosts }, { data: followRows }] = await Promise.all([
      supabase.from("posts").select("media_type, rating").eq("user_id", user.id),
      supabase.from("follows").select("followed_id").eq("follower_id", user.id),
    ]);

    const typeScore = new Map<string, number>();
    for (const p of myPosts ?? []) {
      if (p.rating && p.rating >= 4) {
        typeScore.set(p.media_type, (typeScore.get(p.media_type) ?? 0) + 1);
      }
    }
    const favoriteTypes = new Set([...typeScore.keys()]);
    const followedIds = new Set((followRows ?? []).map((r) => r.followed_id));

    forYou = allPosts
      .filter((p) => p.user_id !== user.id && (p.rating ?? 0) >= 4)
      .filter((p) => followedIds.has(p.user_id) || favoriteTypes.has(p.media_type))
      .sort((a, b) => {
        const aFollowed = followedIds.has(a.user_id) ? 1 : 0;
        const bFollowed = followedIds.has(b.user_id) ? 1 : 0;
        if (aFollowed !== bFollowed) return bFollowed - aFollowed;
        return (b.rating ?? 0) - (a.rating ?? 0);
      })
      .slice(0, 10);
  }


  // Actual new music, not more of what this site already contains.
  //
  // For You and Trending below are both other members' reviews, and on a
  // site this size that is a handful of posts a week. The rails above them
  // walk Last.fm's similar-artist graph on the reader's behalf, starting
  // from what they rated highly - so the page has something to offer on a
  // week when nobody posted at all.
  //
  // Signed out, or signed in and yet to rate anything: the seeds fall back
  // to what the community rated highly, and then to a fixed shortlist. The
  // rails are never empty for want of somebody's own history.
  const mine: SeedPost[] = user
    ? allPosts
        .filter((p) => p.user_id === user.id)
        .map((p) => ({ media_type: p.media_type, title: p.title, artist: p.artist, rating: p.rating }))
    : [];
  const communityPosts: SeedPost[] = allPosts.map((p) => ({
    media_type: p.media_type,
    title: p.title,
    artist: p.artist,
    rating: p.rating,
  }));

  const personalSeeds = seedArtists(mine);
  const seeds = personalSeeds.length > 0 ? personalSeeds : communitySeeds(communityPosts);
  const known = alreadyKnown(mine);

  const [personal, scene, era] = await Promise.all([
    findsForSeeds(seeds, known),
    sceneFinds(known),
    eraFinds(known),
  ]);
  const [personalFinds, sceneRail, eraRail] = await Promise.all([
    enrichFinds(personal),
    enrichFinds(scene.finds),
    enrichFinds(era.finds),
  ]);

  // An empty rail because Last.fm is unreachable and an empty rail because
  // the key was never set look identical, and both look like "there is
  // nothing here" - which is the one thing they do not mean.
  const status = discoveryStatus([personalFinds.length, sceneRail.length, eraRail.length]);
  const railProblem = describeDiscoveryStatus(status);

  return (
    <>
      <OrbyBot />

      <div className="panel">
        <div className="panel-head">Find something new</div>
        <div className="panel-body flush">
          <FindRail
            title={
              personalSeeds.length > 0 ? "Out from what you love" : "Somewhere to start"
            }
            subtitle={
              personalSeeds.length > 0
                ? `One step sideways from ${personalSeeds.slice(0, 2).join(" and ")}`
                : "Rate a few records four or five stars and this row becomes yours"
            }
            finds={personalFinds}
            empty={railProblem || "Nothing new to show here yet - try again shortly."}
          />
          <FindRail
            title={scene.tag}
            subtitle="The scene of the day, past its greatest hits"
            finds={sceneRail}
            empty={railProblem || "That scene came back empty today."}
          />
          <FindRail
            title={`Deeper into the ${era.label}`}
            subtitle="Not the songs from the adverts"
            finds={eraRail}
            empty={railProblem || "That decade came back empty today."}
          />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">For You</div>
        <div className="panel-body flush">
          {!user ? (
            <div className="empty-state" style={{ padding: 16 }}>
              <Link href="/sign-in">Sign in</Link> to get recommendations based on what you rate
              highly and who you follow.
            </div>
          ) : forYou.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>
              Post a review with 4 or 5 stars, or follow some reviewers, and we&apos;ll start
              recommending things here.
            </div>
          ) : (
            forYou.map((post) => (
              <PostCard
                key={post.id}
                post={toCardData(post)}
                currentUserId={user?.id ?? null}
                viewerIsAdmin={viewerIsAdmin}
                liked={likedByMe.has(post.id)}
                likeCount={likeCounts.get(post.id) ?? 0}
                commentCount={commentCounts.get(post.id) ?? 0}
              />
            ))
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Trending</div>
        <div className="panel-body flush">
          {trending.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>
              Nothing trending yet.
            </div>
          ) : (
            trending.map((post) => (
              <PostCard
                key={post.id}
                post={toCardData(post)}
                currentUserId={user?.id ?? null}
                viewerIsAdmin={viewerIsAdmin}
                liked={likedByMe.has(post.id)}
                likeCount={likeCounts.get(post.id) ?? 0}
                commentCount={commentCounts.get(post.id) ?? 0}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
