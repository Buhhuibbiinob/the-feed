import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { coverGradient } from "@/lib/cover";
import { MEDIA_LABELS, type MediaType } from "@/lib/media";

export const alt = "Post on the feed";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type PostRow = {
  id: string;
  media_type: MediaType;
  title: string;
  artist: string | null;
  cover_url: string | null;
  rating: number | null;
  profiles: { username: string } | null;
};

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: postData } = await supabase
    .from("posts")
    .select("id, media_type, title, artist, cover_url, rating, profiles!posts_user_id_fkey(username)")
    .eq("id", id)
    .maybeSingle();
  const post = postData as PostRow | null;

  const title = post?.title ?? "the feed";
  const artist = post?.artist ?? null;
  const username = post?.profiles?.username ?? "someone";
  const rating = post?.rating ?? null;
  const mediaLabel = post ? MEDIA_LABELS[post.media_type] : null;
  const cover = post?.cover_url ?? coverGradient(post?.id ?? "the-feed");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: "#f4f4f2",
          padding: 60,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            width: 380,
            height: 380,
            borderRadius: 16,
            flexShrink: 0,
            display: "flex",
            backgroundImage: post?.cover_url ? `url(${cover})` : cover,
            backgroundSize: "cover",
            backgroundPosition: "center",
            boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 56, flex: 1 }}>
          {mediaLabel && (
            <div
              style={{
                display: "flex",
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: "#0f7a3f",
                marginBottom: 16,
              }}
            >
              {mediaLabel}
            </div>
          )}
          <div style={{ display: "flex", fontSize: 56, fontWeight: 800, color: "#111", lineHeight: 1.1 }}>
            {title}
          </div>
          {artist && (
            <div style={{ display: "flex", fontSize: 30, color: "#555", marginTop: 12 }}>{artist}</div>
          )}
          {rating != null && (
            <div style={{ display: "flex", marginTop: 24, gap: 10 }}>
              {Array.from({ length: 5 }, (_, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: i < rating ? "#e0a000" : "#ddd",
                  }}
                />
              ))}
            </div>
          )}
          <div style={{ display: "flex", fontSize: 26, color: "#888", marginTop: "auto" }}>
            reviewed by {username} · the feed
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
