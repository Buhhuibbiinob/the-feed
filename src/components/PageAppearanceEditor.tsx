"use client";

import { useActionState, useState } from "react";
import {
  applyThemePreset,
  deleteThemePreset,
  savePageAppearance,
  saveThemePreset,
  type PageConfigState,
} from "@/app/actions/pageConfig";
import {
  moduleHint,
  moduleLabel,
  type ModuleState,
  type PageConfig,
  type SurfaceKind,
} from "@/lib/pageConfig";
import {
  BACKGROUND_PATTERNS,
  FONT_PAIRS,
  PRESET_THEMES,
  type BackgroundKind,
} from "@/lib/pageTheme";
import { PageDecorControls } from "@/components/PageDecorControls";
import { PageBackgroundPicker } from "@/components/PageBackgroundPicker";

const initialState: PageConfigState = {};

const COLOR_FIELDS = [
  { key: "bg", label: "Background" },
  { key: "panel", label: "Panels" },
  { key: "text", label: "Text" },
  { key: "accent", label: "Accent" },
] as const;

/**
 * The one editor behind both profile and club customization.
 *
 * Everything is edited locally and saved in a single post of the whole
 * config. A page's appearance is one thing to the person editing it -
 * applying half of it because two saves raced is worse than applying none.
 */
export function PageAppearanceEditor({
  surface,
  ownerId,
  config,
}: {
  surface: SurfaceKind;
  ownerId: string;
  config: PageConfig;
}) {
  const [open, setOpen] = useState(false);
  // Themes are the whole feature for most people: pick one, done. The
  // pickers and the module list are still there, one click away, rather
  // than presented as three equally necessary steps.
  const [advanced, setAdvanced] = useState<"colors" | "look" | "modules" | null>(null);
  const [draft, setDraft] = useState<PageConfig>(config);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [state, formAction, pending] = useActionState(savePageAppearance, initialState);
  const [presetState, presetAction, presetPending] = useActionState(saveThemePreset, initialState);

  const [lastOk, setLastOk] = useState(state.ok);
  if (lastOk !== state.ok) {
    setLastOk(state.ok);
    if (state.ok) setOpen(false);
  }

  const [lastConfig, setLastConfig] = useState(config);
  if (lastConfig !== config) {
    setLastConfig(config);
    setDraft(config);
  }

  function update(patch: Partial<PageConfig>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function setModules(next: ModuleState[]) {
    update({ modules: next });
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= draft.modules.length) return;
    const next = [...draft.modules];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setModules(next);
  }

  if (!open) {
    return (
      <button type="button" className="comment-action" onClick={() => setOpen(true)}>
        Customize this page
      </button>
    );
  }

  const background = draft.background;

  return (
    <div className="avatar-picker page-editor">
      {(state.error || presetState.error) && (
        <div className="form-error">{state.error ?? presetState.error}</div>
      )}

      <div className="field-hint" style={{ marginTop: 0 }}>Pick a look.</div>

      {(
        <>
          <div className="theme-preset-grid">
            {PRESET_THEMES.map((preset) => (
              <button
                type="button"
                key={preset.id}
                className={`theme-preset${draft.themeId === preset.id ? " active" : ""}`}
                onClick={() =>
                  update({
                    themeId: preset.id,
                    palette: preset.id === "none" ? { bg: null, panel: null, text: null, accent: null } : { ...preset.palette },
                    fontPairId: preset.fontPairId,
                    background: { ...preset.background },
                  })
                }
              >
                <span
                  className="theme-preset-swatch"
                  style={{
                    background: preset.palette.bg ?? "var(--panel-head-bg)",
                    borderColor: preset.palette.accent ?? "var(--panel-border)",
                  }}
                >
                  <span
                    className="theme-preset-chip"
                    style={{ background: preset.palette.panel ?? "var(--panel-body-bg)" }}
                  />
                </span>
                <b>{preset.label}</b>
                <span className="sub">{preset.blurb}</span>
              </button>
            ))}
          </div>

          {draft.presets.length > 0 && (
            <div className="saved-presets">
              <div className="favorites-kind-head">Your saved looks</div>
              {draft.presets.map((preset) => (
                <div className="saved-preset-row" key={preset.name}>
                  <span>{preset.name}</span>
                  <span className="layout-move">
                    <form action={applyThemePreset}>
                      <input type="hidden" name="surface" value={surface} />
                      <input type="hidden" name="owner_id" value={ownerId} />
                      <input type="hidden" name="name" value={preset.name} />
                      <button type="submit" className="comment-action">
                        Use
                      </button>
                    </form>
                    <form action={deleteThemePreset}>
                      <input type="hidden" name="surface" value={surface} />
                      <input type="hidden" name="owner_id" value={ownerId} />
                      <input type="hidden" name="name" value={preset.name} />
                      <button type="submit" className="comment-action danger">
                        ✕
                      </button>
                    </form>
                  </span>
                </div>
              ))}
            </div>
          )}

        </>
      )}

      <div className="page-editor-tabs">
        <button
          type="button"
          className={`page-editor-tab${advanced === "colors" ? " active" : ""}`}
          onClick={() => setAdvanced(advanced === "colors" ? null : "colors")}
        >
          Colours &amp; fonts
        </button>
        <button
          type="button"
          className={`page-editor-tab${advanced === "look" ? " active" : ""}`}
          onClick={() => setAdvanced(advanced === "look" ? null : "look")}
        >
          Shape &amp; photo
        </button>
        <button
          type="button"
          className={`page-editor-tab${advanced === "modules" ? " active" : ""}`}
          onClick={() => setAdvanced(advanced === "modules" ? null : "modules")}
        >
          Choose sections
        </button>
      </div>

      {advanced === "colors" && (
        <>
          <form action={presetAction} className="comment-form saved-preset-form">
            <input type="hidden" name="surface" value={surface} />
            <input type="hidden" name="owner_id" value={ownerId} />
            <input type="text" name="name" placeholder="Name this look" maxLength={40} required />
            <button className="btn btn-ghost" type="submit" disabled={presetPending}>
              {presetPending ? "Saving…" : "Save look"}
            </button>
          </form>
          <div className="field-hint">Save the page first, then name the look.</div>

          <div className="skin-fields">
            {COLOR_FIELDS.map((field) => (
              <label className="skin-field" key={field.key}>
                <span>{field.label}</span>
                <input
                  type="color"
                  value={draft.palette[field.key] ?? "#ffffff"}
                  onChange={(e) =>
                    update({
                      themeId: "none",
                      palette: { ...draft.palette, [field.key]: e.target.value },
                    })
                  }
                  aria-label={field.label}
                />
                <button
                  type="button"
                  className="comment-action"
                  onClick={() => update({ palette: { ...draft.palette, [field.key]: null } })}
                  disabled={draft.palette[field.key] === null}
                >
                  Clear
                </button>
              </label>
            ))}
          </div>

          <label className="skin-field">
            <span>Font</span>
            <select
              value={draft.fontPairId}
              onChange={(e) => update({ fontPairId: e.target.value })}
            >
              {FONT_PAIRS.map((pair) => (
                <option value={pair.id} key={pair.id}>
                  {pair.label}
                </option>
              ))}
            </select>
          </label>

          <div className="favorites-kind-head">Background</div>
          <div className="pattern-grid">
            <button
              type="button"
              className={`pattern-chip${background.kind === "none" ? " active" : ""}`}
              onClick={() => update({ background: { kind: "none", value: null } })}
            >
              None
            </button>
            {BACKGROUND_PATTERNS.map((pattern) => (
              <button
                type="button"
                key={pattern.id}
                className={`pattern-chip${
                  background.kind === "pattern" && background.value === pattern.id ? " active" : ""
                }`}
                onClick={() =>
                  update({ background: { kind: "pattern" as BackgroundKind, value: pattern.id } })
                }
              >
                {pattern.label}
              </button>
            ))}
          </div>

        </>
      )}

      {advanced === "look" && (
        <>
          <div className="favorites-kind-head">Photo behind the page</div>
          <PageBackgroundPicker
            surface={surface}
            ownerId={ownerId}
            background={draft.background}
          />
          {draft.background.kind === "image" && (
            <button
              type="button"
              className="comment-action"
              onClick={() => update({ background: { kind: "none", value: null } })}
            >
              Remove photo
            </button>
          )}

          <div className="favorites-kind-head">Shape</div>
          <div className="field-hint">Drag one and watch the page change behind this.</div>
          <PageDecorControls decor={draft.decor} onChange={(decor) => update({ decor })} />
        </>
      )}

      {advanced === "modules" && (
        <>
          <div className="field-hint">Tick what you want. Drag to reorder.</div>
          <ul className="layout-list">
            {draft.modules.map((module, index) => (
              <li
                key={module.id}
                className={`layout-row${module.shown ? "" : " off"}${
                  dragIndex === index ? " dragging" : ""
                }`}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragEnd={() => setDragIndex(null)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragIndex === null || dragIndex === index) return;
                  move(dragIndex, index);
                  setDragIndex(index);
                }}
              >
                <span className="layout-grip" aria-hidden="true">
                  ⠿
                </span>
                <label className="layout-label">
                  <input
                    type="checkbox"
                    checked={module.shown}
                    onChange={() =>
                      setModules(
                        draft.modules.map((m, i) => (i === index ? { ...m, shown: !m.shown } : m))
                      )
                    }
                  />
                  <span>
                    {moduleLabel(module.id)}
                    {moduleHint(module.id) && <span className="sub">{moduleHint(module.id)}</span>}
                  </span>
                </label>
                <span className="layout-move">
                  <button
                    type="button"
                    className="comment-action"
                    onClick={() => move(index, index - 1)}
                    disabled={index === 0}
                    aria-label={`Move ${moduleLabel(module.id)} up`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="comment-action"
                    onClick={() => move(index, index + 1)}
                    disabled={index === draft.modules.length - 1}
                    aria-label={`Move ${moduleLabel(module.id)} down`}
                  >
                    ↓
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <form action={formAction} className="comment-form">
        <input type="hidden" name="surface" value={surface} />
        <input type="hidden" name="owner_id" value={ownerId} />
        <input type="hidden" name="config" value={JSON.stringify(draft)} />
        <div className="form-actions">
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save page"}
          </button>
          <button
            type="button"
            className="comment-action"
            onClick={() => {
              setDraft(config);
              setOpen(false);
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
