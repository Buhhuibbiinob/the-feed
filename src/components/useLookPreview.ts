"use client";

import { useEffect, useRef } from "react";
import { decorVars } from "@/lib/pageDecor";
import { pageStyle } from "@/lib/pageTheme";
import type { PageConfig } from "@/lib/pageConfig";

/**
 * Applies an unsaved look to the real page while you are editing it.
 *
 * Every control the editor has - preset, colour wells, font, background,
 * and the seven shape sliders - runs through the same two functions the
 * server renders with, written onto the live wrapper. So the preview
 * cannot drift from the result: there is no second code path for it to
 * drift in.
 *
 * This is most of what makes Surprise me worth pressing. A shuffle that
 * changed the corners immediately but left the colours until you saved
 * would read as half-broken rather than as a new page.
 */
export function useLookPreview(config: PageConfig, active: boolean) {
  // What this hook put on the element, so it can take exactly that back
  // off. Recomputing from the current config would leak whichever
  // properties the *previous* config set and this one doesn't.
  const applied = useRef<string[]>([]);

  useEffect(() => {
    const page = document.querySelector<HTMLElement>(".profile-skin");
    if (!page) return;

    for (const name of applied.current) page.style.removeProperty(name);
    applied.current = [];
    if (!active) return;

    const vars: Record<string, string> = {
      ...((pageStyle(config.palette, config.fontPairId, config.background) ?? {}) as Record<
        string,
        string
      >),
      ...decorVars(config.decor),
    };
    for (const [name, value] of Object.entries(vars)) page.style.setProperty(name, value);
    applied.current = Object.keys(vars);
  }, [config, active]);

  // Left behind, an unsaved preview would sit there looking saved until
  // the next navigation quietly reverted it.
  useEffect(() => {
    return () => {
      const page = document.querySelector<HTMLElement>(".profile-skin");
      if (!page) return;
      for (const name of applied.current) page.style.removeProperty(name);
    };
  }, []);
}
