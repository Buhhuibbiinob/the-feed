"use client";

import { useSyncExternalStore } from "react";

// The mode lives on <html>, set by the inline script in the layout before
// React ever runs. The toggle has to read it from there rather than keep
// its own copy: a useState default would show "light" on every load for
// anyone browsing in dark, and correcting that in an effect is exactly
// the cascading render React now warns about.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function isDark() {
  return document.documentElement.getAttribute("data-mode") === "dark";
}

export function LightDarkToggle() {
  // There is no <html> attribute to read while rendering on the server, so
  // that pass assumes light and the first client snapshot corrects it.
  const dark = useSyncExternalStore(subscribe, isDark, () => false);

  function toggle(checked: boolean) {
    if (checked) {
      document.documentElement.setAttribute("data-mode", "dark");
      localStorage.setItem("feedback-mode", "dark");
    } else {
      document.documentElement.removeAttribute("data-mode");
      localStorage.setItem("feedback-mode", "light");
    }
    for (const onChange of listeners) onChange();
  }

  return (
    <label className="ios-toggle light-dark-toggle">
      Dark mode
      <input type="checkbox" checked={dark} onChange={(e) => toggle(e.target.checked)} />
      <span className="ios-toggle-track">
        <span className="ios-toggle-knob" />
      </span>
    </label>
  );
}
