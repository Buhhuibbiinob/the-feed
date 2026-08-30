import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_THEME, isValidTheme } from "@/lib/themes";
import { ThemeForm } from "@/components/ThemeForm";
import { SoundToggle } from "@/components/SoundToggle";
import { BackgroundPicker } from "@/components/BackgroundPicker";
import { isBackgroundFit, DEFAULT_BACKGROUND_FIT } from "@/lib/background";
import { disconnectYoutube } from "@/app/actions/youtube";
import { EmailPrefsForm } from "@/components/EmailPrefsForm";
import { resolveEmailPrefs, resolveNudgePref } from "@/lib/emailPrefs";

export const metadata = { title: "Settings - Feedback" };

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
    .select("theme, custom_background_url, background_fit, background_flipped")
    .eq("id", user.id)
    .single();

  const currentTheme = isValidTheme(profile?.theme) ? profile.theme : DEFAULT_THEME;
  const currentFit = isBackgroundFit(profile?.background_fit)
    ? profile.background_fit
    : DEFAULT_BACKGROUND_FIT;

  const { data: prefsRow } = await supabase
    .from("profiles")
    .select("email_prefs")
    .eq("id", user.id)
    .maybeSingle();
  const emailPrefs = resolveEmailPrefs(prefsRow?.email_prefs);
  const nudgePref = resolveNudgePref(prefsRow?.email_prefs);

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
          <BackgroundPicker
            currentUrl={profile?.custom_background_url ?? null}
            currentFit={currentFit}
            currentFlipped={profile?.background_flipped === true}
          />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Sound</div>
        <div className="panel-body">
          <SoundToggle />
          <p className="field-hint" style={{ marginTop: 8 }}>
            A short click when you press something, the way a phone keyboard does. Saved on this
            device, so turning it off here does not silence it on your other ones.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Email notifications</div>
        <div className="panel-body">
          <EmailPrefsForm prefs={emailPrefs} nudge={nudgePref} />
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
