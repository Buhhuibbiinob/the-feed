"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Portal } from "@/components/Portal";
import { dismissAnnouncement } from "@/app/actions/announcements";
import { buttonFor, type Announcement } from "@/lib/announcements";

// What the admin's announcement actually looks like on the screen.
//
// Two shapes from one component, because they are the same message at two
// volumes: the alert stops you and has to be answered, the banner sits
// under the bar and waits to be noticed.

const STORAGE_PREFIX = "feedback:announce:";

function readDismissed(id: string): boolean {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + id) === "1";
  } catch {
    // Private mode, or storage switched off. Not a reason to hide the
    // announcement - it just means this browser forgets.
    return false;
  }
}

function rememberDismissed(id: string) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + id, "1");
  } catch {
    /* see above */
  }
}

// localStorage is a client-only fact that never changes under us, so it
// is read as a store rather than set from a mount effect - the same
// reason Portal does it this way. The server snapshot is "already
// dismissed", which renders nothing: the server cannot know what this
// browser has closed (a signed-out visitor's dismissal exists only
// here), and flashing the alert at somebody who closed it an hour ago is
// worse than showing it one frame late.
const subscribeNever = () => () => {};

export function AnnouncementAlert({ announcement }: { announcement: Announcement | null }) {
  const id = announcement?.id ?? "";
  const [closed, setClosed] = useState(false);
  const remembered = useSyncExternalStore(
    subscribeNever,
    () => (id ? readDismissed(id) : true),
    () => true
  );

  if (!announcement || closed || remembered) return null;

  function close() {
    setClosed(true);
    rememberDismissed(id);
    // Fire and forget: the alert is already gone from this screen, and
    // the server call only decides whether it comes back on the member's
    // other device. Nothing on screen waits for it.
    void dismissAnnouncement(id);
  }

  const action = buttonFor(announcement);

  if (announcement.style === "banner") {
    return (
      <div className="sk-announce-banner" role="status">
        <div className="sk-announce-banner-inner">
          <span className="sk-announce-banner-icon" aria-hidden="true">
            !
          </span>
          <div className="sk-announce-banner-text">
            <b>{announcement.title}</b>
            {announcement.body && <span> {announcement.body}</span>}
          </div>
          {action && (
            <Link href={action.href} className="sk-announce-banner-btn" onClick={close}>
              {action.label}
            </Link>
          )}
          <button
            type="button"
            className="sk-announce-banner-close"
            onClick={close}
            aria-label="Dismiss announcement"
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  return (
    <Portal>
      {/* No click-outside-to-close. Everywhere else on this site that is
          the friendly thing to do, but an announcement that vanishes
          because you tapped the dark part is an announcement that was
          never read, and it does not come back. */}
      <div className="sk-announce-backdrop">
        <div className="sk-announce" role="alertdialog" aria-labelledby="sk-announce-title">
          <div className="sk-announce-title" id="sk-announce-title">
            {announcement.title}
          </div>
          {announcement.body && <div className="sk-announce-message">{announcement.body}</div>}
          <div className="sk-announce-actions">
            <button type="button" onClick={close}>
              {action ? "Close" : "OK"}
            </button>
            {action && (
              <Link href={action.href} className="sk-announce-go" onClick={close}>
                {action.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
