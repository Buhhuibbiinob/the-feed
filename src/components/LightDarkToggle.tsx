"use client";

import { useEffect, useState } from "react";

export function LightDarkToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.getAttribute("data-mode") === "light");
  }, []);

  function toggle(checked: boolean) {
    setLight(checked);
    if (checked) {
      document.documentElement.setAttribute("data-mode", "light");
      localStorage.setItem("feedback-mode", "light");
    } else {
      document.documentElement.removeAttribute("data-mode");
      localStorage.setItem("feedback-mode", "dark");
    }
  }

  return (
    <label className="ios-toggle light-dark-toggle">
      Light mode
      <input type="checkbox" checked={light} onChange={(e) => toggle(e.target.checked)} />
      <span className="ios-toggle-track">
        <span className="ios-toggle-knob" />
      </span>
    </label>
  );
}
