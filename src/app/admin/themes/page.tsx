import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { THEMES, DEFAULT_THEME, isValidTheme } from "@/lib/themes";
import { getAllThemeTokens } from "@/lib/themeTokens";
import { ThemeTokenForm } from "@/components/ThemeTokenForm";

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
  const allTokens = await getAllThemeTokens(supabase);
  const overrides = Object.fromEntries(allTokens.get(selected) ?? []);
  const selectedTheme = THEMES.find((t) => t.id === selected)!;

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
        <div className="panel-head">Pick a theme</div>
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
                  {t.label}
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

      <div className="panel">
        <div className="panel-head">Editing: {selectedTheme.label}</div>
        <div className="panel-body">
          <p className="field-hint" style={{ marginTop: 0 }}>
            {selectedTheme.description}
          </p>
        </div>
      </div>

      <ThemeTokenForm
        key={selected}
        theme={selected}
        themeLabel={selectedTheme.label}
        overrides={overrides}
      />
    </>
  );
}
