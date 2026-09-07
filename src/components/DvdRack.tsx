"use client";

import Link from "next/link";
import { useState } from "react";
import { AddToQueueButton } from "@/components/AddToQueueButton";
import type { ScreenFind } from "@/lib/trailers";

// A stack of DVD cases.
//
// The other rack, and it goes the other way on purpose. Records stand
// upright and you walk along them; cases lie flat and you read DOWN a
// stack with your head on one side. Anybody who has owned either knows
// which way round they go, and getting it backwards would be the loudest
// wrong note on the page.
//
// The spine carries the artwork the way a real one does, so a stack of
// these is a wall of colour with titles across it, which is what the
// shelf in anybody's front room actually looks like.

export function DvdRack({
  title,
  becauseOf,
  finds,
  empty,
}: {
  title: string;
  becauseOf: string | null;
  finds: ScreenFind[];
  empty: string;
}) {
  // One case out at a time. Two trailers playing over each other on a
  // page about watching things is the thing that must not happen, and it
  // is the same rule the records follow one rack up.
  const [openKey, setOpenKey] = useState<string | null>(null);
  const opened = finds.find((find) => find.key === openKey) ?? null;

  return (
    <section className="rack-section">
      <div className="rack-card">
        <h2>{title}</h2>
        <p>
          {becauseOf
            ? `Because you keep coming back to ${becauseOf}. Pull one out to watch the trailer.`
            : "Pull one out to watch the trailer before you commit an evening to it"}
        </p>
      </div>

      <div className="rack">
        {finds.length === 0 ? (
          <div className="rack-empty">{empty}</div>
        ) : (
          <>
            <div className="dvd-stack">
              {finds.map((find) => (
                <button
                  key={find.key}
                  type="button"
                  className={`dvd-spine${find.key === openKey ? " pulled" : ""}`}
                  aria-pressed={find.key === openKey}
                  onClick={() => setOpenKey(find.key === openKey ? null : find.key)}
                >
                  {/* The artwork face on, cropped rather than squashed.
                      A trailer thumbnail is sixteen by nine and a case is
                      five by seven, and stretching one across the other
                      gave a row of letterboxed banners. */}
                  {find.imageUrl ? (
                    <span
                      className="dvd-ink"
                      style={{ backgroundImage: `url(${find.imageUrl})` }}
                      aria-hidden="true"
                    />
                  ) : null}
                  <span className="dvd-title">{find.title}</span>
                  {find.year ? <span className="dvd-year">{find.year}</span> : null}
                </button>
              ))}
            </div>

            {/* The case you pulled, opened under the rack rather than in
                it: a player wedged between two leaning cases shoves the
                whole row sideways as it loads. */}
            {opened && (
              <div className="dvd-open">
                <div className="dvd-open-head">
                  <b>{opened.title}</b>
                  <span>{opened.year ?? opened.channel}</span>
                </div>
                <iframe
                  // autoplay is fine: it only ever runs because somebody
                  // pulled this exact case out.
                  src={`https://www.youtube.com/embed/${opened.videoId}?autoplay=1&rel=0`}
                  title={`${opened.title} trailer`}
                  allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
                <div className="dvd-open-actions">
                  <Link href={`/post/new?type=movie_tv&title=${encodeURIComponent(opened.title)}`}>
                    Review
                  </Link>
                  <AddToQueueButton
                    mediaType="movie_tv"
                    title={opened.title}
                    artist={opened.year}
                    coverUrl={opened.imageUrl}
                  />
                  <button type="button" onClick={() => setOpenKey(null)}>
                    Put it back
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
