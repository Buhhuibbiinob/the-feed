"use client";

import Link from "next/link";
import { AddToQueueButton } from "@/components/AddToQueueButton";
import type { ScreenFind } from "@/lib/screenDiscovery";
import { genreLabel } from "@/lib/genres";

// Films and shows, in the same rail shape as the music.
//
// Posters rather than square covers, and no play button: there is no
// thirty-second preview of a film, and a button that opened a trailer
// somewhere else would be a different promise from the one the music
// cards make.

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
  return (
    <section className="find-rail">
      <div className="find-rail-head">
        <h2>{title}</h2>
        <p>
          {becauseOf
            ? `You keep rating ${genreLabel(becauseOf).toLowerCase()} four and five — well reviewed, and not the ones everybody has seen`
            : "Well reviewed, and not the ones everybody has seen"}
        </p>
      </div>
      {finds.length === 0 ? (
        <div className="find-rail-empty">{empty}</div>
      ) : (
        <div className="find-row">
          {finds.map((find) => {
            const reviewHref = `/post/new?type=movie_tv&title=${encodeURIComponent(find.title)}`;
            return (
              <article className="find-card screen-card" key={find.key}>
                <div className="screen-poster">
                  {find.imageUrl ? (
                    <img src={find.imageUrl} alt="" loading="lazy" />
                  ) : (
                    <div className="screen-poster-blank" aria-hidden="true" />
                  )}
                  {/* Which of the two it is. A rail mixing films and
                      series without saying which is which makes somebody
                      start a "film" that turns out to be six hours. */}
                  <span className="screen-kind">{find.kind === "tv" ? "Series" : "Film"}</span>
                </div>
                <div className="find-name" title={find.title}>
                  {find.title}
                </div>
                <div className="find-artist">
                  {find.year ?? "—"} · {find.rating.toFixed(1)}
                </div>
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
