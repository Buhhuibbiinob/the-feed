"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "feedback_welcome_seen";

// Whether the welcome has been dismissed lives in localStorage, which is
// outside React. Reading it in an effect and calling setState meant a
// first paint without the modal followed by a second one with it - the
// cascading render React now warns about, and a visible flash.
const listeners = new Set<() => void>();

// Belt and braces for the case where reading localStorage works but
// writing it doesn't (quota, some private modes): without this the modal
// would refuse to close.
let dismissedThisSession = false;

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function hasSeenWelcome() {
  if (dismissedThisSession) return true;
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    // localStorage unavailable - treat it as seen rather than showing the
    // modal on every single page load.
    return true;
  }
}

export function WelcomeExplainer({ signedIn = false }: { signedIn?: boolean }) {
  // The server has no localStorage, so it renders nothing and the first
  // client snapshot decides.
  const seen = useSyncExternalStore(subscribe, hasSeenWelcome, () => true);

  function dismiss() {
    dismissedThisSession = true;
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    for (const onChange of listeners) onChange();
  }

  if (seen) return null;

  return (
    <div className="welcome-modal-backdrop" onClick={dismiss}>
      <div className="welcome-modal" onClick={(e) => e.stopPropagation()}>
        <div className="welcome-modal-title">
          Welcome to Feedback
          <button className="welcome-modal-close" onClick={dismiss} aria-label="Close">
            ×
          </button>
        </div>
        <div className="welcome-modal-body">
          <p>
            Feedback is a community feed for rating and sharing the music, movies, and TV you&apos;re
            into - post a quick review and see what everyone else is watching and listening to.
          </p>
          {!signedIn && (
            // The feed has never been gated, but nothing said so. A first-time
            // visitor facing a modal reasonably assumes there's a wall behind
            // it, which costs the same bounces an actual wall would.
            <p className="welcome-modal-free">
              <b>Have a look around first.</b> Reading the feed, profiles and reviews needs no
              account - you only need one to post, rate or follow.
            </p>
          )}
          <ul className="welcome-modal-list">
            <li>
              <b>Clubs</b>
              {" - fan clubs for specific artists, movies, and shows. One gets proposed automatically the first time someone reviews something new."}
            </li>
            <li>
              <b>Leaderboard</b>
              {" - the most active reviewers, ranked by how much they've posted."}
            </li>
            <li>
              <b>Wrapped</b>
              {" - your personal year-in-review: top genres, top posts, and stats about what you rated."}
            </li>
          </ul>
        </div>
        <div className="welcome-modal-actions">
          <button className="btn btn-ghost" onClick={dismiss}>
            {signedIn ? "Maybe later" : "Just browsing"}
          </button>
          {signedIn ? (
            <button className="btn" onClick={dismiss}>
              Got it
            </button>
          ) : (
            <a className="btn" href="/sign-up" onClick={dismiss}>
              Create account
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
