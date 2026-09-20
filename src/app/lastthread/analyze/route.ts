import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { SUBGENRE_IDS } from "@/lib/lastthreadSubgenres";

// Looks at a photograph of an outfit and says what it is made of.
//
// The analyser on /lastthread/find-your-style used to ask people to tag the
// subgenre themselves, because a static page cannot run a model. This route
// can: it sends the picture to Claude and gets back the subgenres, the
// garments it can see, and what to search for in a shop.
//
// It costs money per call, so two guards:
//   1. you have to be signed in to mythefeed.com, and
//   2. one photograph at a time, of a sane size.
// Without ANTHROPIC_API_KEY set it says so plainly rather than failing, and
// the page falls back to tagging by hand.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const noStore = { "cache-control": "no-store" };

// Data URLs arrive as "data:image/jpeg;base64,...". Claude takes the media
// type and the payload separately, and only these four types.
const ALLOWED = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type Allowed = (typeof ALLOWED)[number];

function splitDataUrl(dataUrl: string): { mediaType: Allowed; data: string } | null {
  const m = /^data:([^;,]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!m) return null;
  const mediaType = m[1].toLowerCase() as Allowed;
  if (!ALLOWED.includes(mediaType)) return null;
  return { mediaType, data: m[2] };
}

export async function POST(request: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "The analyser is not switched on. It needs ANTHROPIC_API_KEY set on the project." },
      { status: 503, headers: noStore }
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in with your mythefeed.com account to use the analyser." },
      { status: 401, headers: noStore }
    );
  }

  let body: { image?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400, headers: noStore });
  }

  const parsed = body.image ? splitDataUrl(body.image) : null;
  if (!parsed) {
    return NextResponse.json(
      { error: "Send one photograph, as a JPEG, PNG, GIF or WebP." },
      { status: 400, headers: noStore }
    );
  }
  // ~5MB of base64 is about 3.7MB of picture, which is plenty for a photo the
  // page has already downscaled.
  if (parsed.data.length > 5_000_000) {
    return NextResponse.json(
      { error: "That picture is too big. Try a smaller one." },
      { status: 413, headers: noStore }
    );
  }

  const client = new Anthropic({ apiKey: key });

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 2000,
      system:
        "You are a clothing historian reading a photograph for LastThread, a fashion history site. " +
        "Name what you can actually see: garments, cut, cloth where it is legible, and the era the " +
        "shapes belong to. Be plain and specific, the way a tailor or a vintage dealer would be. " +
        "Do not guess a brand unless a logo is legible. Do not describe the person, only the clothes. " +
        "If the photograph does not show clothing, say so in `notes` and return empty lists.",
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["subgenres", "garments", "look_for", "notes"],
            properties: {
              subgenres: {
                type: "array",
                description: "The LastThread subgenres this outfit belongs to, most confident first.",
                items: { type: "string", enum: [...SUBGENRE_IDS] },
              },
              garments: {
                type: "array",
                description: "Each garment visible: what it is, its cut, and the cloth if legible.",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["name", "detail"],
                  properties: {
                    name: { type: "string" },
                    detail: { type: "string" },
                  },
                },
              },
              look_for: {
                type: "array",
                description: "What to type into a vintage shop's search box to find pieces like these.",
                items: { type: "string" },
              },
              notes: {
                type: "string",
                description: "One or two sentences on the era and lineage of the look.",
              },
            },
          },
        },
      },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: parsed.mediaType, data: parsed.data } },
            { type: "text", text: "Read this outfit." },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "The model would not read that picture. Try a different one." },
        { status: 422, headers: noStore }
      );
    }

    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      return NextResponse.json({ error: "No answer came back." }, { status: 502, headers: noStore });
    }

    return NextResponse.json(JSON.parse(text.text), { headers: noStore });
  } catch (err) {
    const message = err instanceof Error ? err.message : "The analyser failed.";
    return NextResponse.json({ error: message }, { status: 502, headers: noStore });
  }
}
