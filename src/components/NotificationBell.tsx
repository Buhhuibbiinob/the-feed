"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { markNotificationsSeen } from "@/app/actions/notifications";
import { IconButton } from "@/components/IconButton";
import { describeAlert, type AlertItem as NotificationItem } from "@/lib/alertText";
import { createClient } from "@/lib/supabase/client";

export function NotificationBell({ initialCount }: { initialCount: number }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (open) setOpen(false);
  }

  // The badge used to be whatever the server rendered on last navigation,
  // so an alert that arrived while you sat on a page stayed invisible
  // until you clicked something. It now subscribes for the duration of
  // the session and updates in place.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let refreshing = false;

    async function refresh() {
      if (refreshing) return;
      refreshing = true;
      try {
        const res = await fetch("/api/notifications");
        const data = await res.json();
        if (cancelled) return;
        const next: NotificationItem[] = data.notifications ?? [];
        setItems(next);
        // While the panel is open the member is looking at them, so
        // re-badging what they're currently reading would be noise.
        setOpen((isOpen) => {
          if (!isOpen) setCount(next.length);
          return isOpen;
        });
      } catch {
        // Keep whatever is on screen.
      } finally {
        refreshing = false;
      }
    }

    const channel = supabase.channel("alerts-bell");
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

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      setCount(0);
      void markNotificationsSeen();
      if (items === null) {
        setLoading(true);
        fetch("/api/notifications")
          .then((r) => r.json())
          .then((data) => setItems(data.notifications ?? []))
          .catch(() => setItems([]))
          .finally(() => setLoading(false));
      }
    }
  }

  return (
    <div className="nav-bell" ref={ref}>
      <IconButton
        onClick={toggleOpen}
        badge={count}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Notifications"
      >
        Alerts
      </IconButton>
      {open && (
        <div className="nav-bell-menu">
          <div className="nav-bell-menu-head">Notifications</div>
          {loading ? (
            <div className="empty-state" style={{ padding: 16 }}>
              Loading...
            </div>
          ) : !items || items.length === 0 ? (
            <div className="empty-state" style={{ padding: 16 }}>
              No notifications yet.
            </div>
          ) : (
            items.map((item) => (
              <Link
                key={item.id}
                href={item.postId ? `/post/${item.postId}` : `/profile/${item.actorUsername}`}
                className="nav-bell-row"
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
            ))
          )}
        </div>
      )}
    </div>
  );
}
