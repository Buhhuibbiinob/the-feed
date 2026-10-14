import Link from "next/link";
import { FEED_HOME } from "@/lib/closed";

export function SiteFooter() {
  return (
    <footer>
      <div className="links">
        <Link href={FEED_HOME}>Feed</Link>
        <Link href="/chat">Live Chat</Link>
        <Link href="/leaderboard">Leaderboard</Link>
        <Link href="/new-releases">New Releases</Link>
        <Link href="/recs">Recs</Link>
        <Link href="/wrapped">Wrapped</Link>
        <Link href="/newsletter">Newsletter</Link>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/terms">Terms of Service</Link>
      </div>
      <div className="copy">© 2026 Feedback. all rights reserved.</div>
    </footer>
  );
}
