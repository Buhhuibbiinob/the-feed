"use client";

import { useSyncExternalStore, useState } from "react";
import { decorateServerSnapshot, isDecorating, subscribeDecorate } from "@/lib/decorate";
import { savePageAppearance } from "@/app/actions/pageConfig";
import {
  moduleLabel,
  resolvedColumn,
  type ModuleId,
  type ModuleState,
  type PageConfig,
} from "@/lib/pageConfig";

/**
 * Drag panels around on the profile itself, rather than ticking rows in a
 * settings panel.
 *
 * The panels are rendered on the server and handed in as nodes keyed by
 * module id, so this only decides where each one goes - it never has to
 * know what any of them contain.
 *
 * Arrange mode is off by default. Making panels permanently draggable
 * would mean every attempt to select text inside one starts a drag
 * instead, which is the usual way this pattern goes wrong.
 */
export function ProfileArranger({
  ownerId,
  config,
  order,
  panels,
  sideHeader,
  mainHeader,
  isOwner,
}: {
  ownerId: string;
  config: PageConfig;
  order: ModuleId[];
  panels: Record<string, React.ReactNode>;
  sideHeader?: React.ReactNode;
  mainHeader?: React.ReactNode;
  isOwner: boolean;
}) {
  // Follows the shared decorating flag rather than its own toggle, so
  // panels and stickers are one mode instead of two.
  const arranging = useSyncExternalStore(subscribeDecorate, isDecorating, decorateServerSnapshot);
  const [modules, setModules] = useState<ModuleState[]>(config.modules);
  const [dragId, setDragId] = useState<ModuleId | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [lastConfig, setLastConfig] = useState(config);
  if (lastConfig !== config) {
    setLastConfig(config);
    setModules(config.modules);
    setDirty(false);
  }

  const stateFor = (id: ModuleId) => modules.find((m) => m.id === id);
  const columnOf = (id: ModuleId) => resolvedColumn(stateFor(id), id);

  const visible = order.filter((id) => panels[id]);
  const side = visible.filter((id) => columnOf(id) === "side");
  const main = visible.filter((id) => columnOf(id) === "main");

  /** Moves the dragged panel to sit before `beforeId`, in that column. */
  function drop(column: "main" | "side", beforeId: ModuleId | null) {
    if (!dragId) return;
    setModules((current) => {
      const moved = current.find((m) => m.id === dragId);
      if (!moved) return current;
      const without = current.filter((m) => m.id !== dragId);
      const updated: ModuleState = { ...moved, column };
      if (!beforeId) return [...without, updated];
      const index = without.findIndex((m) => m.id === beforeId);
      if (index === -1) return [...without, updated];
      return [...without.slice(0, index), updated, ...without.slice(index)];
    });
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const data = new FormData();
      data.set("surface", "profile");
      data.set("owner_id", ownerId);
      data.set("config", JSON.stringify({ ...config, modules }));
      await savePageAppearance({}, data);
      setDirty(false);
      // Deliberately stays in decorating mode. Saving the layout used to
      // kick you out, which is wrong for something people do in one long
      // sitting - you are almost always about to move the next thing.
      // Leaving is what the Done button is for.
    } finally {
      setSaving(false);
    }
  }

  function column(name: "main" | "side", ids: ModuleId[], header?: React.ReactNode) {
    return (
      <div
        className={`profile-col-${name}${arranging ? " arranging" : ""}`}
        onDragOver={(e) => {
          if (arranging) e.preventDefault();
        }}
        onDrop={() => arranging && drop(name, null)}
      >
        {header}
        {ids.map((id) => (
          <div
            key={id}
            className={`arrange-slot${dragId === id ? " dragging" : ""}`}
            draggable={arranging}
            onDragStart={() => setDragId(id)}
            onDragEnd={() => setDragId(null)}
            onDragOver={(e) => {
              if (!arranging) return;
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              if (!arranging) return;
              e.stopPropagation();
              drop(name, id);
            }}
          >
            {arranging && (
              <div className="arrange-bar">
                <span className="layout-grip" aria-hidden="true">
                  ⠿
                </span>
                <span>{moduleLabel(id)}</span>
                <button
                  type="button"
                  className="comment-action"
                  onClick={() => {
                    setDragId(id);
                    drop(name === "side" ? "main" : "side", null);
                    setDragId(null);
                  }}
                >
                  {name === "side" ? "Send right →" : "← Send left"}
                </button>
              </div>
            )}
            {panels[id]}
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Only the Save button lives here now; entering and leaving the
          mode is the one Decorate control at the foot of the page. */}
      {isOwner && arranging && (
        <div className="arrange-toolbar">
          <span className="field-hint">Drag a panel, or send it to the other column.</span>
          <button type="button" className="btn" onClick={save} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save layout"}
          </button>
        </div>
      )}

      <div className="profile-columns">
        {column("side", side, sideHeader)}
        {column("main", main, mainHeader)}
      </div>
    </>
  );
}
