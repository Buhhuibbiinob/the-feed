"use client";

import dynamic from "next/dynamic";
import { Portal } from "@/components/Portal";
import type { StoreSnapshot } from "@/lib/store";
import "./store.css";

// The record store, loaded only in the browser: three.js has nothing to
// render on a server, and nobody who never opens the homepage should
// download it.
const StoreExperience = dynamic(() => import("./StoreExperience").then((m) => m.StoreExperience), {
  ssr: false,
  loading: () => (
    <div className="ps2">
      <div className="ps2-overlay ps2-loading" role="status">
        <div className="t">Loading...</div>
        <div className="tip">THE RECORD STORE</div>
      </div>
    </div>
  ),
});

/**
 * Rendered into <body> through Portal: the page transition puts a
 * transform on the wrapper around every page, which would otherwise make
 * the full-screen stage anchor to the page and sit under the site's own
 * popups. `fontClass` carries the store's font variables with it.
 */
export function StoreClient({
  fontClass,
  ...props
}: {
  initial: StoreSnapshot;
  launchAt: string | null;
  serverNow: string;
  fontClass: string;
}) {
  return (
    <Portal>
      <div className={fontClass}>
        <StoreExperience {...props} />
      </div>
    </Portal>
  );
}
