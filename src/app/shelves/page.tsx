import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { guardBuiltinPage } from "@/lib/pages";
import { ShelfDividers } from "@/components/ShelfDividers";
import { ShelfRecords } from "@/components/ShelfRecords";
import { FilmShelf } from "@/components/FilmShelf";
import { PhotoShelf } from "@/components/PhotoShelf";
import {
  MEDIA,
  axes,
  isComingSoon,
  getShelf,
  SHELF_SIZE,
  isAxis,
  isMedium,
  isShelfValue,
  shelfTitle,
  shelfYears,
  filmPlaceTerm,
  type Medium,
} from "@/lib/shelves";
import { filmShelf } from "@/lib/trailers";
import { getPrints } from "@/lib/photoShelf";
import { describeSearchFailure, searchVideosDetailed } from "@/lib/youtube";
import { getShelfFromPosts } from "@/lib/shelfPosts";
import type { Sleeve } from "@/lib/crate";
import { decadeTagForYear } from "@/lib/physicalMedia";
import {
  alreadyKnown,
  describeDiscoveryStatus,
  discoveryStatus,
  shuffleSeed,
  type SeedPost,
} from "@/lib/musicDiscovery";

export const metadata = { title: "Shelves on Feedback" };

/**
 * A wall of dividers.
 *
 * The third way people find music, after chance and after being
 * recommended to: choosing an axis and walking down it. Nobody has ever
 * wanted "music like the music you listen to" as often as they have
 * wanted "something from 1979", because a mood is usually a time or a
 * place or a scene - and none of those is a neighbour of anybody's
 * listening history.
 *
 * State lives in the URL, so a shelf can be sent to somebody, opened in
 * a tab and come back to with the back button.
 */
export default async function ShelvesPage({
  searchParams,
}: {
  searchParams: Promise<{ medium?: string; axis?: string; value?: string }>;
}) {
  const supabase = await createClient();
  await guardBuiltinPage(supabase, "shelves");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { medium: rawMedium, axis: rawAxis, value: rawValue } = await searchParams;
  const now = new Date();
  // Music by default, so every link written before there were three
  // media still lands where it used to.
  const medium: Medium = isMedium(rawMedium) ? rawMedium : "music";
  const wall = axes(now, medium);

  // Checked against THIS medium's axes: "decade" exists for music and
  // for film and they are not the same wall, and "subject" exists only
  // for photography. An axis borrowed from another medium is no axis.
  const axis = isAxis(rawAxis) && wall.some((a) => a.id === rawAxis) ? rawAxis : null;
  // The value goes into a tag query and a search, so it is checked
  // against its own axis rather than trusted from the URL.
  const value = axis && isShelfValue(axis, rawValue, now, medium) ? rawValue : null;

  // Same as the Crate: the only thing read about the person browsing is
  // what they have already written about, and only so it can come off
  // the shelf.
  const { data: myPosts } = user
    ? await supabase
        .from("posts")
        .select("media_type, title, artist, rating")
        .eq("user_id", user.id)
        .returns<SeedPost[]>()
    : { data: null };
  const known = alreadyKnown(myPosts ?? []);

  // A fresh spin per request, so coming back to a shelf is a different
  // set of records rather than the one you have already read.
  const spin = shuffleSeed();

  // Only the medium being looked at is fetched. Asking all three would
  // be a Last.fm call and a hundred YouTube units spent on two walls
  // nobody opened.
  const shelf =
    medium === "music" && axis && value
      ? await getShelf(axis, value, known, spin)
      : { records: [] as Sleeve[], source: "none" as const };

  // The source that cannot fail, behind the two that can.
  //
  // A shelf headed UK R&B was showing "couldn't reach Last.fm" over an
  // empty board, which was wrong twice: that shelf does not come from
  // Last.fm, and an empty board with an apology on it is a page that
  // looks broken. Last.fm can be down or have nothing for a scene it has
  // never heard of, YouTube's allowance runs out at some point in the
  // day, and when both happen there is still one source left that needs
  // no key and cannot be rate limited - the records people here have
  // posted about.
  //
  // Only for a scene, because that is the only axis a post can be
  // matched on: a post carries a genre and does not carry a year.
  const fromPosts =
    medium === "music" && axis === "scene" && value && shelf.records.length < SHELF_SIZE
      ? await getShelfFromPosts(supabase, value, SHELF_SIZE - shelf.records.length)
      : [];
  const already = new Set(shelf.records.map((r) => r.key));
  const records = [...shelf.records, ...fromPosts.filter((r) => !already.has(r.key))];
  const screen =
    medium === "film" && value && (axis === "decade" || axis === "genre" || axis === "place")
      ? await filmShelf(
          axis,
          // A place is asked for by the word a search uses, not by its
          // slug: Nigeria's cinema is found as "nollywood".
          axis === "place" ? filmPlaceTerm(value) ?? value : value,
          known,
          searchVideosDetailed,
          { rotateBy: spin }
        )
      : null;
  const prints =
    medium === "photography" && !isComingSoon(medium) && axis === "subject" && value
      ? await getPrints(supabase, value)
      : [];

  // What to say when there is genuinely nothing.
  //
  // Two lies were being told here and the screenshot had both. Every
  // empty music shelf reported "couldn't reach Last.fm" - including the
  // sixteen scenes that never ask Last.fm at all, so somebody on an
  // empty UK R&B shelf was told to wait for a service with nothing to
  // do with it. And discoveryStatus cannot tell "Last.fm answered with
  // nothing" from "Last.fm did not answer", because every helper in
  // there returns an empty array for both - so a genuinely thin tag was
  // reported as an outage, and waiting for it to clear would have taken
  // forever.
  //
  // Only one of those states is actually knowable, so only that one is
  // claimed: a missing key is a fact. Everything else is said as what it
  // is - a shelf with nothing on it yet - and pointed at the thing that
  // would fix it, which is somebody posting a record.
  const status = discoveryStatus([records.length]);
  const problem =
    medium !== "music" || !axis || !value || records.length > 0
      ? ""
      : status === "not-configured"
        ? describeDiscoveryStatus(status)
        : `Nothing on this shelf yet. Post a ${shelfTitle(axis, value)} record and it goes up here.`;

  const openAxis = axis ? wall.find((a) => a.id === axis) ?? null : null;

  return (
    <div className="panel">
      <div className="panel-head">
        {value && axis ? shelfTitle(axis, value) : "Shelves"}
      </div>
      <div className="panel-body">
        {!openAxis ? (
          <>
            <p className="shelf-intro">
              Pick what you&apos;re in the mood for, not who you are. Nothing on the other side of
              these is ranked for you.
            </p>
            {/* Which wall you are standing in front of. Above the axes
                rather than beside them, because the medium decides what
                the axes even are: a place means something for a record
                and nothing for somebody's photograph. */}
            <div className="shelf-media" role="tablist" aria-label="What to browse">
              {MEDIA.map((m) => (
                <Link
                  key={m.id}
                  href={`/shelves?medium=${m.id}`}
                  className={`shelf-medium${m.id === medium ? " on" : ""}`}
                  aria-current={m.id === medium ? "page" : undefined}
                >
                  <b>
                    {m.label}
                    {m.comingSoon ? <span className="shelf-soon">Soon</span> : null}
                  </b>
                  <span>{m.blurb}</span>
                </Link>
              ))}
            </div>
            {/* The ways in, standing on a shelf like everything else on
                this page. They used to be flat cards on the panel, which
                meant the page announced itself as a shelving unit and
                then opened with rectangles. */}
            {isComingSoon(medium) && (
              <p className="shelf-intro">
                This wall is built and switched off. It reads what people here have shot, and
                nobody can upload a photograph yet.
              </p>
            )}
            <div className="woodwall axes">
              <div className="shelf-axes">
                {wall.map((a) => (
                  <Link
                    key={a.id}
                    href={`/shelves?medium=${medium}&axis=${a.id}`}
                    className="shelf-axis"
                  >
                    <b>{a.label}</b>
                    <span>{a.prompt}</span>
                  </Link>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="shelf-crumbs">
              <Link href="/shelves">Shelves</Link>
              <span aria-hidden="true">/</span>
              <Link href={`/shelves?medium=${medium}`}>
                {MEDIA.find((m) => m.id === medium)?.label ?? "Music"}
              </Link>
              <span aria-hidden="true">/</span>
              {value ? (
                <Link href={`/shelves?medium=${medium}&axis=${openAxis.id}`}>{openAxis.label}</Link>
              ) : (
                <b>{openAxis.label}</b>
              )}
              {value && (
                <>
                  <span aria-hidden="true">/</span>
                  <b>{shelfTitle(openAxis.id, value)}</b>
                </>
              )}
            </div>

            {/* The dividers stay on screen after one is picked. Browsing
                is comparing, and hiding the wall would make every change
                of mind a trip backwards. */}
            <ShelfDividers
              medium={medium}
              axis={openAxis.id}
              // Labelled here rather than in the client. Handing it the
              // labelling function was a 500 on every axis: a function
              // cannot be serialised across the boundary.
              dividers={openAxis.values.map((v) => ({
                value: v,
                label: shelfTitle(openAxis.id, v),
              }))}
              open={value}
            />

            {!value ? (
              <p className="shelf-pick">{openAxis.prompt}</p>
            ) : medium === "film" ? (
              <FilmShelf
                finds={screen?.finds ?? []}
                // What actually went wrong, rather than one sentence for
                // every kind of empty. A missing key, a spent daily
                // quota and a genuinely thin corner of the archive are
                // three different things and only one of them means
                // "try another divider".
                emptyNote={
                  screen?.failure
                    ? describeSearchFailure(screen.failure)
                    : "Nothing behind that divider today. There is a different set tomorrow."
                }
              />
            ) : medium === "photography" && isComingSoon(medium) ? (
              <p className="shelf-empty">
                Photography shelves are built and waiting on one thing: there is no way to
                put a photograph up yet. The wall reads what people here have actually shot,
                which is the only honest source for it, so it stays empty until that works.
              </p>
            ) : medium === "photography" ? (
              <PhotoShelf
                prints={prints}
                // Said as what it is. This wall is built out of what
                // people here have posted rather than out of a
                // catalogue, so an empty subject is not a failure, it is
                // an opening - and the shelf should say so instead of
                // apologising.
                emptyNote={`Nobody has shelved a ${shelfTitle(openAxis.id, value).toLowerCase()} shot yet. Yours would be the first.`}
              />
            ) : (
              <ShelfRecords
                records={records}
                emptyNote={problem || "Nothing behind that divider. Try one either side of it."}
                // A decade shelf gets one format for the whole shelf, so
                // the era is legible from across the room. A year shelf
                // gets the same treatment from its own decade, since
                // 1978 and 1974 were sold on the same object. Every
                // other axis leaves it to the record.
                decade={
                  openAxis.id === "decade"
                    ? value
                    : openAxis.id === "year"
                      ? decadeTagForYear(Number(value))
                      : null
                }
                // Year and Decade put a date in the heading, so what is
                // under them gets checked against it as the lookups come
                // back. Scene and Place claim no date and get no span.
                span={shelfYears(openAxis.id, value)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
