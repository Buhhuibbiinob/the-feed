"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { describeAlert, type AlertItem } from "@/lib/alertText";

// Alerts arrive by realtime subscription rather than polling.
//
// The pushed row is only used as a "something happened" nudge - the list
// is then re-fetched through /api/notifications, which applies the same
// permission rules as the first render. Trusting the payload's contents
// would mean the client deciding what it is allowed to be told about.
export function AlertsList({ initial }: { initial: AlertItem[] }) {
  const [items, setItems] = useState(initial);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let refreshing = false;

    async function refresh() {
      // A burst of rows (someone catching up on your reviews) would
      // otherwise fire a fetch each; one in flight is enough.
      if (refreshing) return;
      refreshing = true;
      try {
        const res = await fetch("/api/notifications");
        const data = await res.json();
        if (!cancelled) setItems(data.notifications ?? []);
      } catch {
        // A dropped refresh just means the list stays as it is.
      } finally {
        refreshing = false;
      }
    }

    const channel = supabase.channel("alerts");
    for (const table of [
      "likes",
      "comments",
      "follows",
      "favorite_reactions",
      "profile_views",
    ]) {
      channel.on("postgres_changes", { event: "INSERT", schema: "public", table }, () => {
        void refresh();
      });
    }
    channel.subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="panel-body flush">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.postId ? `/post/${item.postId}` : `/profile/${item.actorUsername}`}
          className="nav-bell-row alerts-row"
        >
          <img
            src={item.actorAvatarUrl || "/avatars/preset-1.svg"}
            alt=""
            className="nav-bell-avatar"
          />
          <span>
            <b>{item.actorUsername}</b> {describeAlert(item)}
          </span>
        </Link>
      ))}
    </div>
  );
}
