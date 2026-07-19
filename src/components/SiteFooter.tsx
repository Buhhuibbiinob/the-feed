import Link from "next/link";

export function SiteFooter() {
  return (
    <footer>
      <div className="links">
        <Link href="/">Feed</Link>
        <Link href="/chat">Live Chat</Link>
        <Link href="/leaderboard">Leaderboard</Link>
        <Link href="/new-releases">New Releases</Link>
        <Link href="/recs">Recs</Link>
        <Link href="/wrapped">Wrapped</Link>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/terms">Terms of Service</Link>
      </div>
      <div className="copy">© 2026 the feed. all rights reserved.</div>
    </footer>
  );
}
