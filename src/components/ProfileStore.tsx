"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { HERO_SLOTS, type StoreItem } from "@/lib/profileStore";
import type { ProfileLabels } from "@/lib/profileLabels";
import { isMediaSlot, type MediaSlot } from "@/lib/mediaSlots";

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

/**
 * A box the member filled: a picture, or a video that plays.
 *
 * Muted, looping and inline, which is the only combination every browser
 * will start on its own. Unmuted autoplay is blocked outright, and a
 * video with sound that starts by itself on somebody's profile would be
 * the wrong thing to build even if it were allowed - the profile song in
 * the readout above is the one thing here that makes noise.
 */
function SlotMedia({ slot }: { slot: MediaSlot }) {
  if (slot.kind === "video" && slot.youtubeId) {
    return (
      <iframe
        className="store-art store-art-video"
        src={`https://www.youtube.com/embed/${slot.youtubeId}?autoplay=1&mute=1&loop=1&playlist=${slot.youtubeId}&controls=0&playsinline=1&modestbranding=1&rel=0`}
        allow="autoplay; encrypted-media"
        title={slot.title ?? "Profile video"}
        tabIndex={-1}
      />
    );
  }
  if (slot.imageUrl) {
    return <img src={slot.imageUrl} alt="" className="store-art store-art-hero" />;
  }
  return null;
}

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
  seeAllLabel,
}: {
  title: string;
  items: StoreItem[];
  seeAllHref: string;
  seeAllLabel: string;
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
          {seeAllLabel}
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
  profileTile,
  hero,
  shelves,
  promos,
  chart,
  artists,
  genres,
  username,
  labels,
  actions,
  caption,
  statusBar,
  nowPlaying,
  avatarUrl,
  slots,
}: {
  /** The first banner is whose page this is - their picture, their name,
   *  their review count. The store is about a person, and three album
   *  covers with no face among them does not say that. */
  profileTile?: StoreItem | null;
  hero: StoreItem[];
  shelves: { title: string; items: StoreItem[]; seeAllHref: string }[];
  promos: StoreItem[];
  chart: StoreItem[];
  artists: string[];
  genres: string[];
  username: string;
  labels: ProfileLabels;
  /** Follow / share / more, laid over the hero photo on a phone. */
  actions?: React.ReactNode;
  /** Their bio and what they're listening to, under the name. */
  caption?: React.ReactNode;
  /** The counts. iTunes put "25 songs, 1:46:40 total time, 124 MB" along
   *  the bottom of the window; this is the same line for a person. */
  statusBar?: React.ReactNode;
  /** Their profile song, in the window's own readout. */
  nowPlaying?: React.ReactNode;
  /** Their actual profile picture. The hero tile behind it is their
   *  banner, which is wallpaper - this is the face. */
  avatarUrl?: string | null;
  /** The six boxes, already resolved: the member's choice where they
   *  made one, the store's own pick where they didn't. */
  slots?: (MediaSlot | StoreItem | null)[];
}) {
  return (
    <div className="store">
      {nowPlaying}
      {/* On a phone the profile tile is not one of three banners - it is
          the screen. The reference is the Apple Music artist page: a
          full-bleed photo about 40% tall with the name sitting on it,
          and everything else revealed by scrolling. The same markup does
          both; only the CSS differs. */}
      {(profileTile || hero.length > 0) && (
        <div className="store-hero">
          {profileTile && (
            <div className="store-hero-tile store-hero-me">
              <Art item={profileTile} size="hero" />
              {/* The avatar sits INSIDE the caption block as a flex
                  child rather than absolutely beside it. Positioning it
                  absolutely meant offsetting the text with a
                  padding-left, and .store-hero-text sets `padding`
                  shorthand - so the two fought and the name rendered
                  underneath the photo. A row that lays itself out cannot
                  have that argument. */}
              <span className="store-hero-text">
                {avatarUrl && (
                  <img src={avatarUrl} alt="" className="store-hero-avatar" />
                )}
                <span className="store-hero-lines">
                  <b>{profileTile.title}</b>
                  <span>{profileTile.subtitle}</span>
                  {caption && <span className="store-hero-caption">{caption}</span>}
                </span>
              </span>
              {/* Phone only: the row of actions the reference puts under
                  the name. Rendered here rather than in a panel so it
                  sits on the photo, where it belongs. */}
              {actions && <span className="store-hero-actions">{actions}</span>}
            </div>
          )}
          {/* One fewer record when the profile tile is present, so the
              row stays three wide rather than wrapping to four. */}
          {(slots
            ? slots.slice(1, HERO_SLOTS).filter((s): s is MediaSlot | StoreItem => !!s)
            : profileTile
              ? hero.slice(0, HERO_SLOTS - 1)
              : hero
          ).map((entry, i) =>
            isMediaSlot(entry) ? (
              <span key={`slot-${i}`} className="store-hero-tile">
                <SlotMedia slot={entry} />
                {(entry.title || entry.subtitle) && (
                  <span className="store-hero-text">
                    <span className="store-hero-lines">
                      <b>{entry.title}</b>
                      <span>{entry.subtitle}</span>
                    </span>
                  </span>
                )}
              </span>
            ) : (
              <Link key={entry.id} href={entry.href} className="store-hero-tile">
                <Art item={entry} size="hero" />
                <span className="store-hero-text">
                  <span className="store-hero-lines">
                    <b>{entry.title}</b>
                    <span>{entry.subtitle}</span>
                  </span>
                </span>
              </Link>
            )
          )}
        </div>
      )}

      <div className="store-body">
        <aside className="store-side">
          {genres.length > 0 && (
            <form action={`/profile/${username}`} className="store-genre">
              <select name="genre" defaultValue="" aria-label="Choose genre">
                <option value="">{labels.store_genre}</option>
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
              <div className="store-side-head">{labels.store_artists}</div>
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
            <Shelf key={shelf.title} {...shelf} seeAllLabel={labels.store_see_all} />
          ))}
          {(() => {
            const bottom = slots
              ? slots.slice(HERO_SLOTS).filter((s): s is MediaSlot | StoreItem => !!s)
              : promos;
            if (bottom.length === 0) return null;
            return (
              <div className="store-promos">
                {bottom.map((entry, i) =>
                  isMediaSlot(entry) ? (
                    <span key={`pslot-${i}`} className="store-promo">
                      <SlotMedia slot={entry} />
                      {entry.title && <span className="store-promo-text">{entry.title}</span>}
                    </span>
                  ) : (
                    <Link key={entry.id} href={entry.href} className="store-promo">
                      <Art item={entry} size="promo" />
                      <span className="store-promo-text">{entry.title}</span>
                    </Link>
                  )
                )}
              </div>
            );
          })()}
        </div>

        {chart.length > 0 && (
          <aside className="store-chart">
            <div className="store-chart-head">{labels.store_chart}</div>
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
              {labels.store_all_reviews}
            </Link>
          </aside>
        )}
      </div>

      {statusBar && <div className="store-statusbar">{statusBar}</div>}
    </div>
  );
}
