import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { selectPosts } from "@/lib/postQuery";
import { PostCard } from "@/components/PostCard";
import { MEDIA_FILTER_LABELS, type MediaType } from "@/lib/media";

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

type ProfileRow = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
};

type WorkHit = {
  id: string;
  media_type: MediaType;
  title: string;
  artist: string | null;
  cover_url: string | null;
};

type ClubHit = { id: string; name: string; media_type: MediaType; status: string };

type CollectionHit = {
  id: string;
  name: string;
  description: string | null;
  profiles: { username: string } | { username: string }[] | null;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!query) {
    return (
      <div className="panel">
        <div className="panel-head">Search</div>
        <div className="panel-body">
          <p className="empty-state">Search for a review, artist, movie, show, or username.</p>
        </div>
      </div>
    );
  }

  const escaped = query.replace(/[%_]/g, (c) => `\\${c}`);
  const pattern = `%${escaped}%`;

  const [
    postRows,
    { data: profileRows },
    { data: workRows },
    { data: clubRows },
    { data: collectionRows },
    { data: likeRows },
    { data: commentRows },
  ] = await Promise.all([
      selectPosts<PostRow>(
        (columns) =>
          supabase
            .from("posts")
            .select(`${columns}, profiles!posts_user_id_fkey(username)`)
            .or(`title.ilike.${pattern},artist.ilike.${pattern},body.ilike.${pattern}`)
            .order("created_at", { ascending: false })
            .limit(30)
            .returns<PostRow[]>(),
        "id, user_id, media_type, title, body, rating, created_at, artist, cover_url, spotify_track_id, youtube_video_id, genre"
      ),
      supabase
        .from("profiles")
        .select("id, username, avatar_url, bio")
        .ilike("username", pattern)
        .limit(20)
        .returns<ProfileRow[]>(),
      // The things themselves, not just reviews that mention them. A
      // search for "Dune" wants the page with everybody's ratings on it,
      // which existed but could only be reached by clicking "2 others
      // reviewed this" on a card - so only when two people happened to
      // have reviewed the same thing.
      supabase
        .from("works")
        .select("id, media_type, title, artist, cover_url")
        .or(`title.ilike.${pattern},artist.ilike.${pattern}`)
        .limit(12)
        .returns<WorkHit[]>(),
      // Pending clubs are not public yet, and banned ones never will be.
      supabase
        .from("clubs")
        .select("id, name, media_type, status")
        .ilike("name", pattern)
        .eq("status", "approved")
        .limit(12)
        .returns<ClubHit[]>(),
      supabase
        .from("collections")
        .select("id, name, description, profiles!collections_user_id_fkey(username)")
        .or(`name.ilike.${pattern},description.ilike.${pattern}`)
        .limit(12)
        .returns<CollectionHit[]>(),
      supabase.from("likes").select("post_id, user_id"),
      supabase.from("comments").select("post_id"),
    ]);

  const posts = postRows ?? [];
  const profiles = profileRows ?? [];
  const works = workRows ?? [];
  const clubs = clubRows ?? [];
  const collections = collectionRows ?? [];

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


  const nothingElse =
    profiles.length === 0 && works.length === 0 && clubs.length === 0 && collections.length === 0;

  return (
    <>
      {/* Things first. Somebody searching a title usually wants the thing,
          with everybody's ratings on it - not the most recent review that
          happened to mention it. */}
      {works.length > 0 && (
        <div className="panel">
          <div className="panel-head">Things</div>
          <div className="panel-body flush">
            {works.map((work) => (
              <Link href={`/work/${work.id}`} key={work.id} className="search-person-row">
                {work.cover_url ? (
                  <img src={work.cover_url} alt="" className="search-person-avatar square" />
                ) : (
                  <span className="search-person-avatar square blank" aria-hidden="true" />
                )}
                <div className="search-person-info">
                  <b>{work.title}</b>
                  <span>
                    {work.artist ? `${work.artist} · ` : ""}
                    {MEDIA_FILTER_LABELS[work.media_type]}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {profiles.length > 0 && (
        <div className="panel">
          <div className="panel-head">People</div>
          <div className="panel-body flush">
            {profiles.map((p) => (
              <Link href={`/profile/${p.username}`} key={p.id} className="search-person-row">
                <img src={p.avatar_url || "/avatars/preset-1.svg"} alt="" className="search-person-avatar" />
                <div className="search-person-info">
                  <b>{p.username}</b>
                  {p.bio && <span>{p.bio}</span>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {clubs.length > 0 && (
        <div className="panel">
          <div className="panel-head">Clubs</div>
          <div className="panel-body flush">
            {clubs.map((club) => (
              <Link href={`/clubs/${club.id}`} key={club.id} className="search-person-row">
                <span className="search-person-avatar square blank" aria-hidden="true" />
                <div className="search-person-info">
                  <b>{club.name}</b>
                  <span>{MEDIA_FILTER_LABELS[club.media_type]} club</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {collections.length > 0 && (
        <div className="panel">
          <div className="panel-head">Collections</div>
          <div className="panel-body flush">
            {collections.map((collection) => {
              const owner = Array.isArray(collection.profiles)
                ? collection.profiles[0]
                : collection.profiles;
              return (
                <Link
                  href={`/collections/${collection.id}`}
                  key={collection.id}
                  className="search-person-row"
                >
                  <span className="search-person-avatar square blank" aria-hidden="true" />
                  <div className="search-person-info">
                    <b>{collection.name}</b>
                    <span>{owner?.username ? `by ${owner.username}` : "A collection"}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">Reviews</div>
        <div className="panel-body flush">
          {posts.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>
              {nothingElse
                ? `No results for "${query}".`
                : `No reviews match "${query}" - but see above.`}
            </div>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={{
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
                }}
                currentUserId={user?.id ?? null}
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
