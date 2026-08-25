"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { markNotificationsSeen } from "@/app/actions/notifications";

type NotificationItem = {
  id: string;
  type: "like" | "comment" | "follow" | "view" | "reaction" | "twin";
  actorUsername: string;
  actorAvatarUrl: string | null;
  postId: string | null;
  postTitle: string | null;
  subject: string | null;
  emoji: string | null;
  createdAt: string;
};

function describe(item: NotificationItem) {
  switch (item.type) {
    case "like":
      return item.postTitle ? `liked your review "${item.postTitle}"` : "liked your review";
    case "comment":
      return item.postTitle
        ? `commented on your review "${item.postTitle}"`
        : "commented on your review";
    case "view":
      return "looked at your profile";
    case "reaction":
      return item.subject
        ? `reacted ${item.emoji ?? ""} to your pick "${item.subject}"`.trim()
        : "reacted to one of your picks";
    case "twin":
      return item.subject ? `is your taste twin - ${item.subject} match` : "is your taste twin";
    case "follow":
      return "started following you";
  }
}

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
      <button
        type="button"
        className="nav-bell-btn"
        onClick={toggleOpen}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Notifications"
      >
        Alerts
        {count > 0 && <span className="nav-bell-badge">{count > 9 ? "9+" : count}</span>}
      </button>
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
                  <b>{item.actorUsername}</b> {describe(item)}
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
