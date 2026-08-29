"use client";

import {
  DECOR_CONTROLS,
  DEFAULT_DECOR,
  decorIsDefault,
  type Decor,
} from "@/lib/pageDecor";

/**
 * The sliders that replaced the CSS box.
 *
 * Dragging one changes the page behind the editor immediately - the
 * editor applies the whole draft through useLookPreview, using the same
 * functions the server renders with. That is the part that made the CSS
 * editor unusable for anyone who does not already write CSS: you had to
 * hold the outcome in your head, save, and reload to find out you were
 * wrong.
 */
export function PageDecorControls({
  decor,
  onChange,
}: {
  decor: Decor;
  onChange: (next: Decor) => void;
}) {
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
