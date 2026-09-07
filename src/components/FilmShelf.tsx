"use client";

import Link from "next/link";
import { useState } from "react";
import { AddToQueueButton } from "@/components/AddToQueueButton";
import type { ScreenFind } from "@/lib/trailers";

/**
 * A shelf of films.
 *
 * The same wooden shelf the records stand on, because a shelf of DVDs in
 * anybody's house looks exactly like a shelf of records except the cases
 * are taller than they are wide. Face out, standing on the board, with
 * the case's moulded spine down its leading edge.
 *
 * The trailer opens UNDER the shelf rather than in it. A player dropped
 * between two cases shoves the whole row sideways as it loads, and the
 * thing you were about to look at moves out from under your eye.
 */
export function FilmShelf({ finds, emptyNote }: { finds: ScreenFind[]; emptyNote: string }) {
  // One case out at a time. Two trailers playing over each other on a
  // page about watching things is the thing that must not happen.
  const [openKey, setOpenKey] = useState<string | null>(null);
  const opened = finds.find((find) => find.key === openKey) ?? null;

  if (finds.length === 0) return <p className="shelf-empty">{emptyNote}</p>;

  return (
    <>
      <div className="woodwall">
        <div className="woodgrid">
          {finds.map((find) => (
            <article className="woodslot" key={find.key}>
              <button
                type="button"
                className={`wooditem fmt-case as-button${find.key === openKey ? " pulled" : ""}`}
                aria-pressed={find.key === openKey}
                onClick={() => setOpenKey(find.key === openKey ? null : find.key)}
              >
                {/* Cropped rather than squashed. A trailer thumbnail is
                    sixteen by nine and a case is five by seven, and the
                    middle of the thumbnail is the thing the trailer is
                    about. */}
                {find.imageUrl ? (
                  <img src={find.imageUrl} alt="" loading="lazy" decoding="async" />
                ) : (
                  // A case with no artwork gets its title printed on it,
                  // the same as a record with no cover gets a white
                  // label. An empty rectangle in a row of covers reads as
                  // something that failed to load; a printed sleeve reads
                  // as a film you have not seen the poster for, which is
                  // what it is - and it is still reviewable either way.
                  <span className="wood-blank">
                    <span className="wood-label-print">
                      <b>{find.title}</b>
                      <i>{find.year ?? find.channel}</i>
                    </span>
                  </span>
                )}
              </button>
              <div className="woodlabel">
                <b title={find.title}>{find.title}</b>
                <span>{find.year ?? find.channel}</span>
              </div>
              <div className="woodactions">
                <Link
                  href={`/post/new?type=movie_tv&title=${encodeURIComponent(find.title)}`}
                  className="wood-link"
                >
                  Review
                </Link>
                <AddToQueueButton
                  mediaType="movie_tv"
                  title={find.title}
                  artist={find.year}
                  coverUrl={find.imageUrl}
                />
              </div>
            </article>
          ))}
        </div>
      </div>

      {opened && (
        <div className="dvd-open">
          <div className="dvd-open-head">
            <b>{opened.title}</b>
            <span>{opened.year ?? opened.channel}</span>
          </div>
          <iframe
            // autoplay is fine: it only ever runs because somebody took
            // this exact case off the shelf.
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
  );
}
