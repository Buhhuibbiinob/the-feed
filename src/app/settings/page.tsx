import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_THEME, isValidTheme } from "@/lib/themes";
import { ThemeForm } from "@/components/ThemeForm";
import { BackgroundPicker } from "@/components/BackgroundPicker";
import { disconnectYoutube } from "@/app/actions/youtube";

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

  const { data: youtubeAccount } = await supabase
    .from("youtube_accounts")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const youtubeConnected = !!youtubeAccount;

  return (
    <>
      <div className="panel">
        <div className="panel-head">Settings</div>
        <div className="panel-body">
          <ThemeForm currentTheme={currentTheme} />
          <BackgroundPicker />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Connect Your Accounts</div>
        <div className="connect-body">
          <div className="connect-btn" style={{ background: "linear-gradient(160deg, #3ee08a, #0f7a3f)" }}>
            <span className="mark" />
            <span>Spotify</span>
            <span className="soon">Coming soon</span>
          </div>
          <div className="connect-btn" style={{ background: "linear-gradient(160deg, #01b4e4, #0d253f)" }}>
            <span className="mark" />
            <span>TMDB</span>
            <span className="soon">Coming soon</span>
          </div>
          {youtubeConnected ? (
            <form action={disconnectYoutube} className="connect-btn live" style={{ background: "linear-gradient(160deg, #ff5c5c, #7a0f0f)" }}>
              <span className="mark" />
              <span>YouTube</span>
              <button type="submit" className="soon connect-action">
                Connected · Disconnect
              </button>
            </form>
          ) : (
            <a
              href="/api/youtube/connect"
              className="connect-btn live"
              style={{ background: "linear-gradient(160deg, #ff5c5c, #7a0f0f)" }}
            >
              <span className="mark" />
              <span>YouTube</span>
              <span className="soon">Connect</span>
            </a>
          )}
        </div>
      </div>
    </>
  );
}
