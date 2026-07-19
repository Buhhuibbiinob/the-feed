"use client";

import { useActionState, useEffect } from "react";
import { updateTheme, type ThemeFormState } from "@/app/actions/theme";
import { THEMES } from "@/lib/themes";

const initialState: ThemeFormState = {};

export function ThemeForm({ currentTheme }: { currentTheme: string }) {
  const [state, action, pending] = useActionState(updateTheme, initialState);

  useEffect(() => {
    if (!state.ok) return;
    const theme = document.querySelector<HTMLSelectElement>("select[name=theme]")?.value;
    if (theme) document.documentElement.setAttribute("data-theme", theme);
  }, [state]);

  return (
    <form action={action} className="theme-form">
      <label htmlFor="theme-select" className="theme-form-label">
        Site theme
      </label>
      <div className="theme-form-row">
        <select
          id="theme-select"
          name="theme"
          defaultValue={currentTheme}
          className="theme-select"
          onChange={(e) => document.documentElement.setAttribute("data-theme", e.target.value)}
        >

          {THEMES.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.label}
            </option>
          ))}
        </select>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <div className="theme-swatches">
        {THEMES.map((theme) => (
          <div className="theme-swatch" data-theme={theme.id} key={theme.id}>
            <div className="theme-swatch-preview" />
            <div className="theme-swatch-label">{theme.label}</div>
            <div className="theme-swatch-desc">{theme.description}</div>
          </div>
        ))}
      </div>
      {state.error && <div className="form-error">{state.error}</div>}
      {state.ok && <div className="form-message">Theme saved.</div>}
    </form>
  );
}
