import { type NextRequest } from "next/server";
import { isAllowedArtHost } from "@/lib/store";
import { largerArtwork } from "@/lib/storeCatalogue";

// Catalogue artwork, served from this site.
//
// The 3D shop draws covers into WebGL textures, and a browser will not
// let a page read pixels from another origin unless that origin says so.
// Rather than depend on what Apple's image CDN sends, the art comes
// through here: same origin, so the texture always works, and cached
// hard, because a sleeve never changes.
//
// Only Apple's image CDN, and only https. An open "fetch any URL for
// me" route on a server is a way into whatever that server can reach.
export const dynamic = "force-dynamic";

const SIZES = new Set([128, 256, 300, 600]);
const MAX_BYTES = 2_000_000;

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("u") ?? "";
  const size = Number(request.nextUrl.searchParams.get("s") ?? 300);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return new Response("Bad image URL.", { status: 400 });
  }
  if (url.protocol !== "https:" || !isAllowedArtHost(url.hostname) || url.port) {
    return new Response("Not an allowed image host.", { status: 400 });
  }

  const sized = SIZES.has(size) ? largerArtwork(url.toString(), size) : url.toString();
  let upstream: Response;
  try {
    upstream = await fetch(sized, { cache: "force-cache", next: { revalidate: 86_400 } });
  } catch {
    return new Response("Artwork unavailable.", { status: 502 });
  }
  const type = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !type.startsWith("image/")) {
    return new Response("Artwork unavailable.", { status: 502 });
  }
  const body = await upstream.arrayBuffer();
  if (body.byteLength > MAX_BYTES) return new Response("Artwork too large.", { status: 502 });

  return new Response(body, {
    headers: {
      "content-type": type,
      "cache-control": "public, max-age=604800, s-maxage=2592000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
