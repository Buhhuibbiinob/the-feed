"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "feedback_welcome_seen";

export function WelcomeExplainer() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable (e.g. private browsing) - just skip it
    }
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  }

  if (!visible) return null;

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
          <button className="btn welcome-modal-btn-ghost" onClick={dismiss}>
            Maybe later
          </button>
          <button className="btn" onClick={dismiss}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
