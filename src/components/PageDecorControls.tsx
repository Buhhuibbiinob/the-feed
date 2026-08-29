"use client";

import { useEffect, useRef } from "react";
import {
  DECOR_CONTROLS,
  DEFAULT_DECOR,
  decorIsDefault,
  decorVars,
  type Decor,
} from "@/lib/pageDecor";

/**
 * The sliders that replaced the CSS box.
 *
 * Each one writes its custom properties straight onto the live page as
 * you drag, so you are adjusting the actual profile rather than reading
 * a number and imagining the result. That is the part that made the CSS
 * editor unusable for anyone who does not already write CSS: you had to
 * hold the outcome in your head, save, and reload to find out you were
 * wrong.
 *
 * The preview and the saved page are produced by the same decorVars(),
 * so what you drag to is what you get.
 */
export function PageDecorControls({
  decor,
  onChange,
}: {
  decor: Decor;
  onChange: (next: Decor) => void;
}) {
  // The properties this component put on the page, so they can be taken
  // off again. Tracked rather than recomputed, because clearing has to
  // remove the ones from the *previous* value, not the current one.
  const applied = useRef<string[]>([]);

  useEffect(() => {
    const page = document.querySelector<HTMLElement>(".profile-skin");
    if (!page) return;

    for (const name of applied.current) page.style.removeProperty(name);
    const vars = decorVars(decor);
    for (const [name, value] of Object.entries(vars)) page.style.setProperty(name, value);
    applied.current = Object.keys(vars);
  }, [decor]);

  // Left behind on unmount the page would keep an unsaved preview until
  // the next navigation, which reads as "it saved" when it did not.
  useEffect(() => {
    const names = applied.current;
    return () => {
      const page = document.querySelector<HTMLElement>(".profile-skin");
      if (!page) return;
      for (const name of names) page.style.removeProperty(name);
    };
  }, []);

  return (
    <div className="decor-controls">
      {DECOR_CONTROLS.map((control) => (
        <label className="decor-row" key={control.key}>
          <span className="decor-label">
            {control.label}
            <span className="sub">{control.hint}</span>
          </span>
          <input
            type="range"
            min={control.min}
            max={control.max}
            step={control.step}
            value={decor[control.key]}
            onChange={(e) => onChange({ ...decor, [control.key]: Number(e.target.value) })}
            aria-label={control.label}
          />
          <output className="decor-value">
            {decor[control.key]}
            {control.unit}
          </output>
        </label>
      ))}

      <button
        type="button"
        className="comment-action"
        onClick={() => onChange({ ...DEFAULT_DECOR })}
        disabled={decorIsDefault(decor)}
      >
        Reset to plain
      </button>
    </div>
  );
}
