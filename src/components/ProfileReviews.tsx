"use client";

import { useState } from "react";

export const PROFILE_REVIEWS_SHOWN = 4;

/**
 * A profile shows four reviews, then offers the rest.
 *
 * Someone with thirty reviews had all thirty stacked down their page, so
 * every profile was mostly one panel and the things that make it theirs
 * - the Top 8, the anthem, the guestbook - were a long scroll below it.
 * Four is enough to see what someone is into.
 *
 * Kept as a client toggle rather than a link to a second page: the rest
 * are already rendered on the server and sitting in the payload, so
 * showing them costs a click rather than a round trip, and nothing is
 * hidden from a visitor who wants it. The feed is untouched - the cap is
 * about a profile being a page about a person, not about reviews being
 * long.
 */
export function ProfileReviews({
  children,
  total,
}: {
  children: React.ReactNode[];
  total: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const hidden = total - PROFILE_REVIEWS_SHOWN;

  return (
    <>
      {expanded ? children : children.slice(0, PROFILE_REVIEWS_SHOWN)}
      {hidden > 0 && (
        <button
          type="button"
          className="reviews-more"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? "Show fewer" : `Show all ${total} reviews`}
        </button>
      )}
    </>
  );
}
