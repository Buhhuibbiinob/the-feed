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
          <div className="dvd-stack">
            {finds.map((find) => {
              const open = find.key === openKey;
              return (
                <div key={find.key}>
                  <button
                    type="button"
                    className={`dvd-spine${open ? " pulled" : ""}`}
                    aria-pressed={open}
                    style={
                      find.imageUrl
                        ? { backgroundImage: `url(${find.imageUrl})` }
                        : { backgroundColor: "#3a3a40" }
                    }
                    onClick={() => setOpenKey(open ? null : find.key)}
                  >
                    <span className="dvd-title">{find.title}</span>
                    {find.year ? <span className="dvd-year">{find.year}</span> : null}
                  </button>

                  {open && (
                    <div className="dvd-open">
                      <div className="dvd-open-head">
                        <b>{find.title}</b>
                        <span>{find.year ?? find.channel}</span>
                      </div>
                      <iframe
                        // autoplay is fine: it only ever runs because
                        // somebody pulled this exact case out.
                        src={`https://www.youtube.com/embed/${find.videoId}?autoplay=1&rel=0`}
                        title={`${find.title} trailer`}
                        allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                        allowFullScreen
                      />
                      <div className="dvd-open-actions">
                        <Link
                          href={`/post/new?type=movie_tv&title=${encodeURIComponent(find.title)}`}
                        >
                          Review
                        </Link>
                        <AddToQueueButton
                          mediaType="movie_tv"
                          title={find.title}
                          artist={find.year}
                          coverUrl={find.imageUrl}
                        />
                        <button type="button" onClick={() => setOpenKey(null)}>
                          Put it back
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
