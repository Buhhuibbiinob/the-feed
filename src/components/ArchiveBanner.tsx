import { REOPENS_AT } from "@/lib/closed";

// A strip across the top of every feed page saying where you are: the feed
// is closed and this is the archive of it. Everything below still works.
// The front door, with the countdown, is the closed page at /.
export function ArchiveBanner() {
  const reopens = new Date(REOPENS_AT).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return (
    <div
      role="note"
      style={{
        background: "linear-gradient(180deg, #f0cf78, #b8862f 55%, #8a6316)",
        borderBottom: "2px solid #5a3f0e",
        color: "#3a2604",
        textAlign: "center",
        padding: "6px 12px",
        font: "600 13px/1.35 Georgia, 'Times New Roman', serif",
        textShadow: "0 1px 0 rgba(255,240,190,.6)",
      }}
    >
      You&rsquo;re in <strong>The Feed Archive</strong>: the old Feed, kept just as it was. The Feed is
      closed while something new is built, back {reopens}.{" "}
      {/* A plain anchor: / is the static closed page the proxy serves, not a
          route the app router knows, so <Link> would try to render it as one. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" style={{ color: "#3a2604", fontWeight: 700 }}>
        See the countdown
      </a>
    </div>
  );
}
