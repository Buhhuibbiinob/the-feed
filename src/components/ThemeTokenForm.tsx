"use client";

import { useActionState } from "react";
import {
  saveThemeTokens,
  resetThemeTokens,
  uploadThemeBackground,
  clearThemeBackground,
  type ThemeTokenState,
} from "@/app/actions/themeTokens";
import { MAX_BACKGROUND_BYTES, megabytes } from "@/lib/uploads";
import { THEME_TOKEN_GROUPS } from "@/lib/themeTokens";

const initialState: ThemeTokenState = {};

export function ThemeTokenForm({
  theme,
  themeLabel,
  overrides,
  hasBackground,
}: {
  theme: string;
  themeLabel: string;
  overrides: Record<string, string>;
  hasBackground: boolean;
}) {
  const [state, action, saving] = useActionState(saveThemeTokens, initialState);
  const [bgState, bgAction, uploading] = useActionState(uploadThemeBackground, initialState);

  const basic = THEME_TOKEN_GROUPS.filter((g) => g.basic);
  const advanced = THEME_TOKEN_GROUPS.filter((g) => !g.basic);

  const field = (token: { name: string; label: string; placeholder: string }) => (
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
  );

  const groupPanel = (group: (typeof THEME_TOKEN_GROUPS)[number]) => (
    <div className="panel" key={group.label} style={{ marginBottom: 14 }}>
      <div className="panel-head">{group.label}</div>
      <div className="panel-body">
        <p className="field-hint" style={{ marginTop: 0, marginBottom: 10 }}>
          {group.hint}
        </p>
        {group.tokens.map(field)}
      </div>
    </div>
  );

  return (
    <>
      <form action={bgAction} className="comment-form" style={{ marginBottom: 18 }}>
        <input type="hidden" name="theme" value={theme} />
        <div className="panel">
          <div className="panel-head">Background image</div>
          <div className="panel-body">
            <p className="field-hint" style={{ marginTop: 0 }}>
              Upload a photo to sit behind {themeLabel}{" "}
              for everyone using it. Drawn over the
              theme&apos;s own colours, so it replaces the pattern without losing the palette. Max{" "}
              {megabytes(MAX_BACKGROUND_BYTES)}MB.
            </p>
            {bgState.error && <div className="form-error">{bgState.error}</div>}
            {bgState.ok && <div className="form-message">{bgState.summary}</div>}
            <input type="file" name="background_file" accept="image/*" required />
            <div className="form-actions">
              <button className="btn" type="submit" disabled={uploading}>
                {uploading ? "Uploading…" : "Upload background"}
              </button>
            </div>
          </div>
        </div>
      </form>

      {hasBackground && (
        <form action={clearThemeBackground} style={{ marginBottom: 18 }}>
          <input type="hidden" name="theme" value={theme} />
          <button type="submit" className="comment-action danger">
            Remove {themeLabel}&apos;s uploaded background
          </button>
        </form>
      )}

      <form action={action}>
        <input type="hidden" name="theme" value={theme} />
        {state.error && <div className="form-error">{state.error}</div>}
        {state.ok && <div className="form-message">{state.summary}</div>}

        <p className="field-hint" style={{ marginBottom: 14 }}>
          Blank means &quot;use the stylesheet&quot;. Anything you type here overrides {themeLabel} for
          everyone using it. Values are plain CSS - semicolons, braces and url() are refused.
        </p>

        {basic.map(groupPanel)}

        <details style={{ marginBottom: 14 }}>
          <summary className="field-hint" style={{ cursor: "pointer", marginBottom: 8 }}>
            Advanced - layout, panels, navigation, buttons
          </summary>
          {advanced.map(groupPanel)}
        </details>

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
