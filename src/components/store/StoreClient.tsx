"use client";

import dynamic from "next/dynamic";
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

export function StoreClient(props: { initial: StoreSnapshot; launchAt: string | null; serverNow: string }) {
  return <StoreExperience {...props} />;
}
