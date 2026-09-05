"use client";

import { useState } from "react";
import { setThemeName } from "@/app/actions/themeTokens";
import { MAX_THEME_NAME } from "@/lib/themeNames";

// Renaming a theme.
//
// The five themes ship named after the decades they look like, which is
// the honest description but not necessarily what this site wants to call
// them. Blank puts the shipped name back, so there is no separate reset
// button to explain.

export function ThemeNameForm({
  theme,
  name,
  shippedName,
}: {
  theme: string;
  name: string;
  shippedName: string;
}) {
  const [value, setValue] = useState(name);
  const renamed = value.trim() !== shippedName;

  return (
    <div className="panel">
      <div className="panel-head">Editing: {name}</div>
      <div className="panel-body">
        <form action={setThemeName}>
          <input type="hidden" name="theme" value={theme} />
          <div className="field">
            <label htmlFor={`theme-name-${theme}`}>Name</label>
            <input
              id={`theme-name-${theme}`}
              name="name"
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={MAX_THEME_NAME}
              placeholder={shippedName}
            />
            <p className="field-hint">
              What people see in Settings. Leave it empty to go back to{" "}
              <b>{shippedName}</b>.
              {renamed && " Renaming changes the label only - nobody's theme moves."}
            </p>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn">
              Save name
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
