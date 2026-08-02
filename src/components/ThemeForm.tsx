"use client";

import { useActionState, useEffect, useState } from "react";
import { updateTheme, type ThemeFormState } from "@/app/actions/theme";
import { THEMES } from "@/lib/themes";

const initialState: ThemeFormState = {};

export function ThemeForm({ currentTheme }: { currentTheme: string }) {
  const [state, action, pending] = useActionState(updateTheme, initialState);
  const [selected, setSelected] = useState(currentTheme);

  useEffect(() => {
    if (!state.ok) return;
    document.documentElement.setAttribute("data-theme", selected);
  }, [state, selected]);

  function pick(themeId: string) {
    setSelected(themeId);
    document.documentElement.setAttribute("data-theme", themeId);
  }

  function shuffle() {
    const others = THEMES.filter((t) => t.id !== selected);
    const random = others[Math.floor(Math.random() * others.length)];
    pick(random.id);
  }

  return (
    <form action={action} className="theme-form">
      <label className="theme-form-label">Site theme</label>

      <input type="hidden" name="theme" value={selected} />

      <div className="theme-swatches">
        {THEMES.map((theme) => (
          <div
            className={`theme-swatch ${selected === theme.id ? "selected" : ""}`}
            data-theme={theme.id}
            key={theme.id}
            onClick={() => pick(theme.id)}
          >
            <div className="theme-swatch-preview" />
            <div className="theme-swatch-label">{theme.label}</div>
            <div className="theme-swatch-desc">{theme.description}</div>
          </div>
        ))}
      </div>

      <div className="form-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={shuffle}>
          Surprise Me
        </button>
      </div>
      {state.error && <div className="form-error">{state.error}</div>}
      {state.ok && <div className="form-message">Theme saved.</div>}
    </form>
  );
}
