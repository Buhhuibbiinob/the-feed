"use client";

import { useActionState } from "react";
import { saveThemeTokens, resetThemeTokens, type ThemeTokenState } from "@/app/actions/themeTokens";
import { THEME_TOKEN_GROUPS } from "@/lib/themeTokens";

const initialState: ThemeTokenState = {};

export function ThemeTokenForm({
  theme,
  themeLabel,
  overrides,
}: {
  theme: string;
  themeLabel: string;
  overrides: Record<string, string>;
}) {
  const [state, action, saving] = useActionState(saveThemeTokens, initialState);

  return (
    <>
      <form action={action}>
        <input type="hidden" name="theme" value={theme} />
        {state.error && <div className="form-error">{state.error}</div>}
        {state.ok && <div className="form-message">{state.summary}</div>}

        <p className="field-hint" style={{ marginBottom: 14 }}>
          Blank means &quot;use the stylesheet&quot;. Anything you type here overrides {themeLabel} for
          everyone using it. Values are plain CSS - semicolons, braces and url() are refused.
        </p>

        {THEME_TOKEN_GROUPS.map((group) => (
          <div className="panel" key={group.label} style={{ marginBottom: 14 }}>
            <div className="panel-head">{group.label}</div>
            <div className="panel-body">
              <p className="field-hint" style={{ marginTop: 0, marginBottom: 10 }}>
                {group.hint}
              </p>
              {group.tokens.map((token) => (
                <div className="field" key={token.name}>
                  <label htmlFor={`${theme}${token.name}`}>
                    {token.label} <span className="dm-inbox-time">{token.name}</span>
                  </label>
                  <input
                    id={`${theme}${token.name}`}
                    name={token.name}
                    type="text"
                    defaultValue={overrides[token.name] ?? ""}
                    placeholder={token.placeholder}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="form-actions">
          <button className="btn" type="submit" disabled={saving}>
            {saving ? "Saving…" : `Save ${themeLabel}`}
          </button>
        </div>
      </form>

      <form action={resetThemeTokens} style={{ marginTop: 10 }}>
        <input type="hidden" name="theme" value={theme} />
        <button type="submit" className="comment-action danger">
          Reset {themeLabel} to the stylesheet
        </button>
      </form>
    </>
  );
}
