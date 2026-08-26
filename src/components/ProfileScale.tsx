"use client";

import { useLayoutEffect, useRef } from "react";

/** The width the profile is composed at. Everything scales from here. */
export const PROFILE_DESIGN_WIDTH = 880;

/**
 * Renders the profile at one fixed width and scales the whole thing down
 * to fit a narrow screen.
 *
 * The alternative - reflowing to a single column on mobile - means a
 * member arranges their page on a desktop and it lands somewhere else
 * entirely on a phone. Stickers are the clearest case: they're positioned
 * as a percentage of the profile box, so a tall narrow box puts a sticker
 * that sat beside the photo halfway down the page instead. Whatever
 * someone builds should look the same to everyone who sees it.
 *
 * `zoom` rather than `transform: scale()` because zoom actually reflows
 * layout, so the page below the profile ends up in the right place. A
 * transform would leave a gap the height of the unscaled profile.
 */
export function ProfileScale({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  // Layout effect, not a plain effect: this runs before the browser
  // paints, so the profile never flashes at full width and then snap to
  // size.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Firefox only gained `zoom` in 126. Where it's missing, fall back to
    // a transform - which doesn't reflow, so the wrapper's height has to
    // be corrected by hand or everything below sits in a gap.
    const canZoom =
      typeof CSS !== "undefined" && CSS.supports && CSS.supports("zoom", "0.5");

    function fit() {
      const node = ref.current;
      if (!node) return;
      const available = node.parentElement?.clientWidth ?? window.innerWidth;
      // Never scale up: on a wide screen the profile sits at its design
      // width rather than stretching into something nobody arranged.
      const scale = Math.min(1, available / PROFILE_DESIGN_WIDTH);

      if (canZoom) {
        node.style.zoom = scale >= 1 ? "" : String(scale);
        return;
      }

      if (scale >= 1) {
        node.style.transform = "";
        node.style.height = "";
        return;
      }
      node.style.transform = `scale(${scale})`;
      node.style.height = `${node.scrollHeight * scale}px`;
    }

    fit();

    // ResizeObserver rather than a window listener: the column can change
    // width without the window doing so.
    const observer = new ResizeObserver(fit);
    if (el.parentElement) observer.observe(el.parentElement);
    window.addEventListener("orientationchange", fit);

    return () => {
      observer.disconnect();
      window.removeEventListener("orientationchange", fit);
    };
  }, []);

  return (
    <div className="profile-scale-frame">
      <div ref={ref} className="profile-scale" style={{ width: PROFILE_DESIGN_WIDTH }}>
        {children}
      </div>
    </div>
  );
}
