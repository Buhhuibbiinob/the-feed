"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { StoreItem } from "@/lib/profileStore";

// The iTunes Music Store front page, built out of one member's reviews.
//
// Four pieces, in the reference's order: three featured banners, shelves
// of cover art with arrows and "See All", a row of wide promo tiles, and
// a numbered chart down the right.
//
// The shelf is the only part with behaviour. In 2003 the arrows paged
// through a fixed grid; here the shelf is a scroller and the arrows page
// it, which means the same control works with a trackpad, a finger and a
// mouse instead of only the last one.

function Art({ item, size }: { item: StoreItem; size: "hero" | "shelf" | "promo" }) {
  if (item.coverUrl) {
    return <img src={item.coverUrl} alt="" className={`store-art store-art-${size}`} />;
  }
  // Nothing is ever drawn as a broken image: a review with no artwork
  // gets a sleeve with its own initial on it.
  return (
    <span className={`store-art store-art-${size} store-art-blank`} aria-hidden="true">
      {item.title.slice(0, 1).toUpperCase()}
    </span>
  );
}

function Shelf({
  title,
  items,
  seeAllHref,
}: {
  title: string;
  items: StoreItem[];
  seeAllHref: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);

  function pageBy(direction: -1 | 1) {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth, behavior: "smooth" });
  }

  function onScroll() {
    const el = track.current;
    if (!el || el.clientWidth === 0) return;
    setPage(Math.round(el.scrollLeft / el.clientWidth));
  }

  // The dots in the reference are pages, not items - four records under
  // one dot. Ceil so a half-full last page still gets one.
  const pages = Math.max(1, Math.ceil(items.length / 4));

  if (items.length === 0) return null;

  return (
    <section className="store-shelf">
      <header className="store-shelf-head">
        <span className="store-shelf-title">{title}</span>
        <span className="store-shelf-dots" aria-hidden="true">
          {Array.from({ length: pages }, (_, i) => (
            <span key={i} className={`store-dot${i === page ? " active" : ""}`} />
          ))}
        </span>
        <Link href={seeAllHref} className="store-see-all">
          See All
        </Link>
      </header>
      <div className="store-shelf-body">
        <button
          type="button"
          className="store-arrow"
          onClick={() => pageBy(-1)}
          aria-label={`Scroll ${title} back`}
        >
          ‹
        </button>
        <div className="store-track" ref={track} onScroll={onScroll}>
          {items.map((item) => (
            <Link key={item.id} href={item.href} className="store-cell">
              <Art item={item} size="shelf" />
              <span className="store-cell-title">{item.title}</span>
              <span className="store-cell-sub">{item.subtitle}</span>
            </Link>
          ))}
        </div>
        <button
          type="button"
          className="store-arrow"
          onClick={() => pageBy(1)}
          aria-label={`Scroll ${title} forward`}
        >
          ›
        </button>
      </div>
    </section>
  );
}

export function ProfileStore({
  hero,
  shelves,
  promos,
  chart,
  artists,
  genres,
  username,
}: {
  hero: StoreItem[];
  shelves: { title: string; items: StoreItem[]; seeAllHref: string }[];
  promos: StoreItem[];
  chart: StoreItem[];
  artists: string[];
  genres: string[];
  username: string;
}) {
  return (
    <div className="store">
      {hero.length > 0 && (
        <div className="store-hero">
          {hero.map((item) => (
            <Link key={item.id} href={item.href} className="store-hero-tile">
              <Art item={item} size="hero" />
              <span className="store-hero-text">
                <b>{item.title}</b>
                <span>{item.subtitle}</span>
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="store-body">
        <aside className="store-side">
          {genres.length > 0 && (
            <form action={`/profile/${username}`} className="store-genre">
              <select name="genre" defaultValue="" aria-label="Choose genre">
                <option value="">Choose Genre</option>
                {genres.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </form>
          )}
          {artists.length > 0 && (
            <div className="store-side-panel">
              <div className="store-side-head">Featured Artists</div>
              <ul className="store-side-list">
                {artists.map((name) => (
                  <li key={name}>
                    <Link href={`/search?q=${encodeURIComponent(name)}`}>{name}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <div className="store-main">
          {shelves.map((shelf) => (
            <Shelf key={shelf.title} {...shelf} />
          ))}
          {promos.length > 0 && (
            <div className="store-promos">
              {promos.map((item) => (
                <Link key={item.id} href={item.href} className="store-promo">
                  <Art item={item} size="promo" />
                  <span className="store-promo-text">{item.title}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {chart.length > 0 && (
          <aside className="store-chart">
            <div className="store-chart-head">Top Rated</div>
            <ol className="store-chart-list">
              {chart.map((item) => (
                <li key={item.id}>
                  <Link href={item.href}>
                    <b>{item.title}</b>
                    <span>{item.subtitle}</span>
                  </Link>
                </li>
              ))}
            </ol>
            <Link href={`/profile/${username}#reviews`} className="store-chart-foot">
              All Reviews
            </Link>
          </aside>
        )}
      </div>
    </div>
  );
}
