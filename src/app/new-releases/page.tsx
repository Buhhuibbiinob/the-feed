import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTrendingTracks } from "@/lib/lastfm";
import { fillMissingArt } from "@/lib/musicArt";
import { newTrailers } from "@/lib/trailers";
import { describeSearchFailure, searchVideosDetailed } from "@/lib/youtube";
import { guardBuiltinPage } from "@/lib/pages";
import { Stars } from "@/components/Stars";
import { CoverArt } from "@/components/CoverArt";

type PostRow = {
  id: string;
  title: string;
  artist: string | null;
  cover_url: string | null;
  rating: number | null;
  created_at: string;
  profiles: { username: string } | null;
};

export const metadata = { title: "New Releases on Feedback" };

export default async function NewReleasesPage() {
  const supabase = await createClient();
  await guardBuiltinPage(supabase, "new-releases");
  const [rawTracks, films, { data: posts }] = await Promise.all([
    getTrendingTracks(20),
    // Trailers rather than a catalogue, the same as the strip on the
    // home page that links here. The two disagreeing about where films
    // come from would show up the moment somebody pressed See All.
    newTrailers(searchVideosDetailed, 20),
    supabase
      .from("posts")
      .select("id, title, artist, cover_url, rating, created_at, profiles!posts_user_id_fkey(username)")
      .eq("media_type", "music")
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<PostRow[]>(),
  ]);

  const tracks = await fillMissingArt(rawTracks);
  const reviews = posts ?? [];

  return (
    <>
      <div className="panel">
        <div className="panel-head">Trending Music</div>
        <div className="release-grid">
          {tracks.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>
              Couldn&apos;t load trending tracks right now - try again later.
            </div>
          ) : (
            tracks.map((track) => (
              <a
                href={`https://www.last.fm/music/${encodeURIComponent(track.artist)}/_/${encodeURIComponent(track.name)}`}
                target="_blank"
                rel="noreferrer"
                className="release-card"
                key={track.id}
              >
                <CoverArt imageUrl={track.imageUrl} seed={track.id} />
                <div className="release-title">{track.name}</div>
                <div className="release-sub">{track.artist}</div>
              </a>
            ))
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">New Movies &amp; TV</div>
        <div className="release-grid">
          {films.finds.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>
              {/* Which kind of empty, rather than one line for all of
                  them. A missing key and a spent quota are somebody's to
                  fix; "try again later" only helps for neither. */}
              {films.failure
                ? describeSearchFailure(films.failure)
                : "No new trailers came back just now. There will be more tomorrow."}
            </div>
          ) : (
            films.finds.map((item) => (
              <a
                href={`https://www.youtube.com/watch?v=${item.videoId}`}
                target="_blank"
                rel="noreferrer"
                className="release-card"
                key={item.key}
              >
                <CoverArt imageUrl={item.imageUrl} seed={item.key} />
                <div className="release-title">{item.title}</div>
                <div className="release-sub">{item.year ?? item.channel}</div>
              </a>
            ))
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Recent Reviews</div>
        <div className="release-grid">
          {reviews.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>
              No music reviews yet: be the first to post one.
            </div>
          ) : (
            reviews.map((post) => (
              <Link href={`/post/${post.id}`} className="release-card" key={post.id}>
                <CoverArt imageUrl={post.cover_url} seed={post.id} />
                <div className="release-title">{post.title}</div>
                <div className="release-sub">{post.artist || post.profiles?.username || "unknown"}</div>
                {post.rating && <div className="release-stars"><Stars rating={post.rating} /></div>}
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  );
}
