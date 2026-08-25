"use client";

import { useEffect } from "react";
import {
  acknowledgeTasteTwin,
  recordProfileView,
  refreshOwnTasteTwin,
} from "@/app/actions/profileActivity";

// Fires the two writes that happen when a profile is opened: logging the
// view on someone else's page, and refreshing your own taste twin if the
// cached one has gone stale.
//
// Both run from the client rather than during the server render because
// Next prefetches route payloads on link hover - a render-time write would
// log views for people who only hovered the link, and would kick off the
// twin rescan from anywhere your own profile happens to be linked.
export function ProfilePing({ profileId, isOwnProfile }: { profileId: string; isOwnProfile: boolean }) {
  useEffect(() => {
    // Failures here are silent on purpose. A view that didn't get logged is
    // not worth an error in front of someone reading a profile.
    if (isOwnProfile) {
      // Opening your own profile is where the twin callout lives, so this
      // is the moment you have seen it - acknowledging here is what stops
      // the notification repeating for a twin you already know about.
      void refreshOwnTasteTwin()
        .then(() => acknowledgeTasteTwin())
        .catch(() => {});
    } else {
      void recordProfileView(profileId).catch(() => {});
    }
  }, [profileId, isOwnProfile]);

  return null;
}
