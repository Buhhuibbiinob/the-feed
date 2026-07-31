import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Feedback - rate the music, movies, and TV you're into";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logoData = await readFile(join(process.cwd(), "public/f-logo.PNG"), "base64");
  const logoSrc = `data:image/png;base64,${logoData}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(155deg, #04101c 0%, #0a3548 30%, #0f6a78 60%, #17a698 85%, #4be0c9 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <img src={logoSrc} width={110} height={110} style={{ borderRadius: 24 }} />
          <div style={{ display: "flex", fontSize: 100, fontWeight: 800, color: "#fff", letterSpacing: -2 }}>
            Feedback
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 34, color: "#dceaf7", marginTop: 28 }}>
          Rate the music, movies &amp; TV you&apos;re into
        </div>
      </div>
    ),
    { ...size }
  );
}
