import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_THEME, isValidTheme } from "@/lib/themes";
import { ThemeForm } from "@/components/ThemeForm";
import { disconnectSpotify } from "@/app/actions/spotify";

export const metadata = { title: "Settings — the feed" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="panel">
        <div className="panel-head">Settings</div>
        <div className="panel-body">
          <p>
            <Link href="/sign-in">Sign in</Link> to manage your settings.
          </p>
        </div>
      </div>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("theme")
    .eq("id", user.id)
    .single();

  const currentTheme = isValidTheme(profile?.theme) ? profile.theme : DEFAULT_THEME;

  const { data: spotifyAccount } = await supabase
    .from("spotify_accounts")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const spotifyConnected = !!spotifyAccount;

  return (
    <>
      <div className="panel">
        <div className="panel-head">Settings</div>
        <div className="panel-body">
          <ThemeForm currentTheme={currentTheme} />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Connect Your Accounts</div>
        <div className="connect-body">
          {spotifyConnected ? (
            <form action={disconnectSpotify} className="connect-btn live" style={{ background: "linear-gradient(160deg, #3ee08a, #0f7a3f)" }}>
              <span className="mark" />
              <span>Spotify</span>
              <button type="submit" className="soon connect-action">
                Connected · Disconnect
              </button>
            </form>
          ) : (
            <a
              href="/api/spotify/connect"
              className="connect-btn live"
              style={{ background: "linear-gradient(160deg, #3ee08a, #0f7a3f)" }}
            >
              <span className="mark" />
              <span>Spotify</span>
              <span className="soon">Connect</span>
            </a>
          )}
          <div className="connect-btn" style={{ background: "linear-gradient(160deg, #5fc9ff, #0d3b7a)" }}>
            <span className="mark" />
            <span>Letterboxd</span>
            <span className="soon">Coming soon</span>
          </div>
        </div>
      </div>
    </>
  );
}
