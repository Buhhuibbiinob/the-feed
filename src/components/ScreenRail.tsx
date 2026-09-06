"use client";

import Link from "next/link";
import { useState } from "react";
import { AddToQueueButton } from "@/components/AddToQueueButton";
import type { ScreenFind } from "@/lib/trailers";

// Films, in the same rail shape as the music.
//
// The music cards have a thirty-second preview and the film cards used
// to have nothing, because a poster does not play. They have the trailer
// now, which is a better thirty seconds than the music gets: it plays in
// the card rather than sending anybody to YouTube, and only the card you
// press loads a player, so a rail of eight is eight thumbnails until
// somebody wants one.

export function ScreenRail({
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
  // One at a time, same rule as the audio previews: two trailers playing
  // over each other on a page about watching things is the thing that
  // must not happen.
  const [playing, setPlaying] = useState<string | null>(null);

  return (
    <section className="find-rail">
      <div className="find-rail-head">
        <h2>{title}</h2>
        <p>
          {becauseOf
            ? `Because you keep coming back to ${becauseOf}. Trailers, so you can see before you commit.`
            : "Trailers, so you can see what it is before you commit an evening to it"}
        </p>
      </div>
      {finds.length === 0 ? (
        <div className="find-rail-empty">{empty}</div>
      ) : (
        <div className="find-row">
          {finds.map((find) => {
            const reviewHref = `/post/new?type=movie_tv&title=${encodeURIComponent(find.title)}`;
            const isPlaying = playing === find.key;
            return (
              <article className="find-card screen-card" key={find.key}>
                <div className="screen-poster">
                  {isPlaying ? (
                    <iframe
                      // autoplay is fine here: it only ever runs because
                      // somebody pressed play on this exact card.
                      src={`https://www.youtube.com/embed/${find.videoId}?autoplay=1&rel=0`}
                      title={`${find.title} trailer`}
                      allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <>
                      {find.imageUrl ? (
                        <img src={find.imageUrl} alt="" loading="lazy" />
                      ) : (
                        <div className="screen-poster-blank" aria-hidden="true" />
                      )}
                      <button
                        type="button"
                        className="screen-play"
                        onClick={() => setPlaying(find.key)}
                      >
                        <span aria-hidden="true">▶</span>
                        <span className="sr-only">Play the {find.title} trailer</span>
                      </button>
                    </>
                  )}
                </div>
                <div className="find-name" title={find.title}>
                  {find.title}
                </div>
                <div className="find-artist">{find.year ?? find.channel}</div>
                <div className="find-actions">
                  <Link href={reviewHref} className="find-review">
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
            );
          })}
        </div>
      )}
    </section>
  );
}
