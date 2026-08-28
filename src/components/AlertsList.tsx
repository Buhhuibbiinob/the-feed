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
    <div className="panel-body flush timeline">
      {items.map((item) => (
        <div className="tl-row" key={item.id}>
          <span className="tl-time">{clockTime(item.createdAt)}</span>
          <span className={`tl-node kind-${item.type}`} aria-hidden="true">
            <AlertIcon type={item.type} />
          </span>
          <Link
            href={item.postId ? `/post/${item.postId}` : `/profile/${item.actorUsername}`}
            className="tl-card"
          >
            <img
              src={item.actorAvatarUrl || "/avatars/preset-1.svg"}
              alt=""
              className="tl-card-avatar"
            />
            <span className="tl-card-body">
              <b>{item.actorUsername}</b>
              <span>{describeAlert(item)}</span>
            </span>
            <span className="tl-card-chevron" aria-hidden="true">
              &rsaquo;
            </span>
          </Link>
        </div>
      ))}
    </div>
  );
}

// Clock time rather than "3h ago". The reference runs a column of exact
// times down the left, and on a list that arrives in bursts an absolute
// time is what lets you see two things happened in the same minute -
// which "3h ago" twice over hides completely.
function clockTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** One glyph per kind of thing that can happen, so the rail is scannable
 *  without reading a word of it. */
function AlertIcon({ type }: { type: AlertItem["type"] }) {
  switch (type) {
    case "like":
    case "reaction":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M12 20s-7-4.6-7-9.3A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.7C19 15.4 12 20 12 20z" />
        </svg>
      );
    case "follow":
    case "twin":
      return (
        <svg viewBox="0 0 24 24">
          <circle cx="9.5" cy="8" r="3.4" />
          <path d="M3.5 19c0-3.2 2.7-5 6-5s6 1.8 6 5z" />
          <path d="M18 8h2v2.2h2.2v2H20V14.5h-2v-2.3h-2.2v-2H18z" />
        </svg>
      );
    case "view":
      return (
        <svg viewBox="0 0 24 24">
          <path d="M12 5c-5 0-8.5 4.4-9 7 .5 2.6 4 7 9 7s8.5-4.4 9-7c-.5-2.6-4-7-9-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24">
          <path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9l-4.5 3.5V16H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
        </svg>
      );
  }
}
