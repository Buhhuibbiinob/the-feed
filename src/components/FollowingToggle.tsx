"use client";

import { useRouter } from "next/navigation";

export function FollowingToggle({ following }: { following: boolean }) {
  const router = useRouter();

  return (
    <label className="ios-toggle">
      Following only
      <input
        type="checkbox"
        checked={following}
        onChange={(e) => router.push(e.target.checked ? "/?filter=following" : "/")}
      />
      <span className="ios-toggle-track">
        <span className="ios-toggle-knob" />
      </span>
    </label>
  );
}
