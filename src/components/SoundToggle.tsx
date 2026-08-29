"use client";

import { useSyncExternalStore } from "react";
import { playClick, setSoundEnabled, soundEnabled } from "@/lib/sound";

// Same pattern as the dark-mode switch: the value lives outside React
// (localStorage), so it is read through a store rather than copied into
// state and corrected in an effect.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function SoundToggle() {
  // The server cannot read localStorage, so it renders the default and
  // the first client snapshot corrects it.
  const on = useSyncExternalStore(subscribe, soundEnabled, () => true);

  function toggle(next: boolean) {
    setSoundEnabled(next);
    // Play the sound you just switched on, so you hear what you chose
    // rather than having to go and click something else to find out.
    if (next) playClick("toggle");
    for (const onChange of listeners) onChange();
  }

  return (
    <label className="ios-toggle">
      Click sounds
      <input type="checkbox" checked={on} onChange={(e) => toggle(e.target.checked)} />
      <span className="ios-toggle-track">
        <span className="ios-toggle-knob" />
      </span>
    </label>
  );
}
