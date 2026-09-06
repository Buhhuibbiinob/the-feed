import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { FindRail } from "@/components/FindRail";
import { ScreenRail } from "@/components/ScreenRail";
import { screenFinds } from "@/lib/screenDiscovery";
import {
  alreadyKnown,
  communitySeeds,
  describeDiscoveryStatus,
  discoveryStatus,
  enrichFinds,
  eraFinds,
  findsForSeeds,
  lovedSceneFinds,
  seedArtists,
  shuffleSeed,
  type SeedPost,
} from "@/lib/musicDiscovery";
import { selectPosts } from "@/lib/postQuery";
import { PostCard, type PostCardData } from "@/components/PostCard";
import { OrbyBot } from "@/components/OrbyBot";
import { FeedTV, type FeedTvClip } from "@/components/FeedTV";
import { fillFeedTvLineup } from "@/lib/feedTv";
import { getTrendingTracks } from "@/lib/lastfm";
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

export const metadata = { title: "Discover - Feedback" };

// Rendered fresh every time. The rails reshuffle per request, and a
// cached page would hand back the same eight records no matter how many
// times somebody refreshed - which is exactly the complaint.
export const dynamic = "force-dynamic";

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
        .map((p) => ({
          media_type: p.media_type,
          title: p.title,
          artist: p.artist,
          rating: p.rating,
          // Carried so the scene rail can be seeded by the styles this
          // person keeps rating highly rather than by the calendar.
          genre: p.genre,
        }))
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

  // The Feed TV, at the top. It lived at the foot of the homepage, where
  // it was the last thing anybody scrolled to; Discover is the page
  // people arrive at wanting something to play.
  const tvClips: FeedTvClip[] = [];
  const seenVideoIds = new Set<string>();
  for (const post of allPosts) {
    if (!post.youtube_video_id || seenVideoIds.has(post.youtube_video_id)) continue;
    seenVideoIds.add(post.youtube_video_id);
    tvClips.push({
      id: post.id,
      title: post.title,
      artist: post.artist,
      youtubeVideoId: post.youtube_video_id,
      username: post.profiles?.username ?? "unknown",
      postId: post.id,
    });
    if (tvClips.length >= 10) break;
  }
  // Filled from the charts when members have not posted four videos
  // between them, so the set is never showing static. This moved here
  // with the player: the homepage was fetching it for a component that
  // no longer lives there.
  const feedTvClips = await fillFeedTvLineup(
    tvClips,
    tvClips.length >= 4 ? [] : await getTrendingTracks(50)
  );

  // A fresh shuffle per request, so refreshing the page genuinely
  // reshuffles rather than showing the same eight records until midnight.
  const rotateBy = shuffleSeed();

  const [personal, scene, era, screen] = await Promise.all([
    findsForSeeds(seeds, known, { rotateBy }),
    // Seeded by the styles this person keeps rating four and five, not
    // by the day - falling back to the day's scene when they have not
    // rated enough for it to mean anything.
    lovedSceneFinds(mine, known, { rotateBy }),
    eraFinds(known, { rotateBy }),
    // Films and shows, the same shape as the music rails. Discover was
    // music only, which on a site whose second category is film meant
    // half the members had nothing here to find.
    screenFinds(mine, known, { rotateBy }),
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

      {feedTvClips.length > 0 && (
        <div className="feedtv-top">
          <FeedTV clips={feedTvClips} />
        </div>
      )}

      <div className="panel">
        <div className="panel-head">Find something new</div>
        <div className="panel-body flush">
          {/* The Crate and Shelves were only reachable from the More
              menu, which is a place nobody browses - so nobody found
              them. Discover is the hub for this, so it names the other
              two doors. */}
          <div className="discover-doors">
            <Link href="/crate" className="discover-door">
              <b>The Crate</b>
              <span>Thirty records in no order. Hear one, keep it or put it back.</span>
            </Link>
            <Link href="/shelves" className="discover-door">
              <b>Shelves</b>
              <span>Browse by a year, a scene, a decade or a place.</span>
            </Link>
          </div>

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
            subtitle={
              scene.fromTaste
                ? "You keep rating this four and five — here's more of it, past the hits"
                : "The scene of the day, past its greatest hits"
            }
            finds={sceneRail}
            empty={railProblem || "That scene came back empty today."}
          />
          <ScreenRail
            title="Something to watch"
            becauseOf={screen.becauseOf}
            finds={screen.finds}
            empty={
              process.env.TMDB_API_KEY
                ? "Nothing new to watch here right now - try again shortly."
                : "Films and shows aren't switched on yet - TMDB_API_KEY is missing."
            }
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
