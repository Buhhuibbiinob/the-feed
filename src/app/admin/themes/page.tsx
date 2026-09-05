import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { THEMES, DEFAULT_THEME, isValidTheme } from "@/lib/themes";
import { getThemeNames } from "@/lib/themeNames";
import { ThemeNameForm } from "@/components/ThemeNameForm";
import { getAllThemeTokens } from "@/lib/themeTokens";
import { ThemeTokenForm } from "@/components/ThemeTokenForm";
import { getSiteTheme } from "@/lib/siteSettings";
import { setSiteTheme } from "@/app/actions/themeTokens";

export const metadata = { title: "Themes - Feedback" };

export default async function AdminThemesPage({
  searchParams,
}: {
  searchParams: Promise<{ theme?: string }>;
}) {
  const { theme: requested } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isAdmin(supabase, user.id))) {
    notFound();
  }

  const selected = isValidTheme(requested) ? requested : DEFAULT_THEME;
  const [allTokens, siteTheme] = await Promise.all([
    getAllThemeTokens(supabase),
    getSiteTheme(supabase),
  ]);
  const overrides = Object.fromEntries(allTokens.get(selected) ?? []);
  const selectedTheme = THEMES.find((t) => t.id === selected)!;
  const themeNames = await getThemeNames(supabase);

  return (
    <>
      <div className="page-header">
        <h1>Themes</h1>
        <div className="tagline">
          Retune any theme&apos;s layout, type, colour and chrome. Changes apply to everyone using
          that theme.
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Theme for the whole site</div>
        <div className="panel-body">
          <p className="field-hint" style={{ marginTop: 0 }}>
            {siteTheme.theme
              ? siteTheme.forced
                ? `Everyone sees ${themeNames[siteTheme.theme] ?? siteTheme.theme}. Their own theme setting is ignored while this is on.`
                : `New accounts and anyone who hasn't picked start on ${THEMES.find((t) => t.id === siteTheme.theme)?.label ?? siteTheme.theme}. People who've chosen keep their own.`
              : "No site theme set - everyone gets their own choice, defaulting to Default."}
          </p>
          <form action={setSiteTheme}>
            <div className="field">
              <label htmlFor="site-theme">Site theme</label>
              <select id="site-theme" name="theme" defaultValue={siteTheme.theme ?? ""}>
                <option value="">No site theme (everyone chooses)</option>
                {THEMES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {themeNames[t.id] ?? t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-actions">
              <button className="btn" type="submit" name="forced" value="false">
                Set as the starting theme
              </button>
              <button className="btn btn-ghost" type="submit" name="forced" value="true">
                Force on everyone
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Pick a theme to edit</div>
        <div className="panel-body flush">
          {THEMES.map((t) => {
            const count = allTokens.get(t.id)?.size ?? 0;
            return (
              <Link
                href={`/admin/themes?theme=${t.id}`}
                key={t.id}
                className="site-links-link"
                style={t.id === selected ? { fontWeight: 700 } : undefined}
              >
                <span>
                  {themeNames[t.id] ?? t.label}
                  {count > 0 && (
                    <span className="dm-inbox-time">
                      {" "}
                      {count} override{count === 1 ? "" : "s"}
                    </span>
                  )}
                </span>
                <span className="site-links-chevron">›</span>
              </Link>
            );
          })}
        </div>
      </div>

      <ThemeNameForm
        key={`name-${selected}`}
        theme={selected}
        name={themeNames[selected] ?? selectedTheme.label}
        shippedName={selectedTheme.label}
      />

      <ThemeTokenForm
        key={selected}
        theme={selected}
        themeLabel={themeNames[selected] ?? selectedTheme.label}
        overrides={overrides}
        hasBackground={Boolean(overrides["--body-image"])}
      />
    </>
  );
}
