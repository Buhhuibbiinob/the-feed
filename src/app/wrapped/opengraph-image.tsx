import { ImageResponse } from "next/og";

export const alt = "Wrapped — the feed";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  const year = new Date().getFullYear();

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
          background: "linear-gradient(150deg, #ffce54, #a8123f)",
          fontFamily: "sans-serif",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
          the feed
        </div>
        <div style={{ display: "flex", fontSize: 96, fontWeight: 800, marginTop: 16 }}>
          Wrapped {year}
        </div>
        <div style={{ display: "flex", fontSize: 32, marginTop: 20, opacity: 0.9 }}>
          Your year in music, movies &amp; TV
        </div>
      </div>
    ),
    { ...size }
  );
}
