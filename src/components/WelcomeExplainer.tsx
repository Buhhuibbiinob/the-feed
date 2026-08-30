"use client";

import { useCallback, useSyncExternalStore } from "react";

// Two keys, not one. The modal is nearly always first seen by somebody
// who is signed out and just looking, and it is dismissed forever - so
// the member version, the one that mentions their page, would never
// reach the people it is for. Signing in earns one more showing.
//
// It is also the only thing resembling a first run: confirming your
// email lands you on the ordinary feed with no acknowledgement that
// anything happened.
const STORAGE_KEY = "feedback_welcome_seen";
const MEMBER_STORAGE_KEY = "feedback_welcome_seen_member";

// Whether the welcome has been dismissed lives in localStorage, which is
// outside React. Reading it in an effect and calling setState meant a
// first paint without the modal followed by a second one with it - the
// cascading render React now warns about, and a visible flash.
const listeners = new Set<() => void>();

// Belt and braces for the case where reading localStorage works but
// writing it doesn't (quota, some private modes): without this the modal
// would refuse to close. Per key, so dismissing the visitor version does
// not also swallow the member one.
const dismissedThisSession = new Set<string>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function hasSeenWelcome(key: string) {
  if (dismissedThisSession.has(key)) return true;
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    // localStorage unavailable - treat it as seen rather than showing the
    // modal on every single page load.
    return true;
  }
}

export function WelcomeExplainer({ signedIn = false }: { signedIn?: boolean }) {
  const key = signedIn ? MEMBER_STORAGE_KEY : STORAGE_KEY;
  // The server has no localStorage, so it renders nothing and the first
  // client snapshot decides.
  const snapshot = useCallback(() => hasSeenWelcome(key), [key]);
  const seen = useSyncExternalStore(subscribe, snapshot, () => true);

  function dismiss() {
    dismissedThisSession.add(key);
    try {
      localStorage.setItem(key, "1");
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
            {/* First, and only once they have an account to hang it on.
                This modal introduced Clubs, the Leaderboard and Wrapped
                and never mentioned the profile at all - the one thing
                that actually separates the people who stay from the
                people who post once and go. */}
            {signedIn && (
              <li>
                <b>Your page</b>
                {" - a picture, a banner, colours, stickers. It's the difference between a name and a person."}
              </li>
            )}
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
