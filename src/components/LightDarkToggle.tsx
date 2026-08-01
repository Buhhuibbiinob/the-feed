"use client";

import { useEffect, useState } from "react";

export function LightDarkToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-mode") === "dark");
  }, []);

  function toggle(checked: boolean) {
    setDark(checked);
    if (checked) {
      document.documentElement.setAttribute("data-mode", "dark");
      localStorage.setItem("feedback-mode", "dark");
    } else {
      document.documentElement.removeAttribute("data-mode");
      localStorage.setItem("feedback-mode", "light");
    }
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
