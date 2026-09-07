import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { guardBuiltinPage } from "@/lib/pages";
import { ShelfDividers } from "@/components/ShelfDividers";
import { ShelfRecords } from "@/components/ShelfRecords";
import { axes, getShelf, isAxis, isShelfValue, shelfTitle } from "@/lib/shelves";
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
  searchParams: Promise<{ axis?: string; value?: string }>;
}) {
  const supabase = await createClient();
  await guardBuiltinPage(supabase, "shelves");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { axis: rawAxis, value: rawValue } = await searchParams;
  const now = new Date();
  const wall = axes(now);

  const axis = isAxis(rawAxis) ? rawAxis : null;
  // The value goes into a tag query, so it is checked against its own
  // axis rather than trusted from the URL.
  const value = axis && isShelfValue(axis, rawValue, now) ? rawValue : null;

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
  const records = axis && value ? await getShelf(axis, value, known, spin) : [];
  const problem = axis && value ? describeDiscoveryStatus(discoveryStatus([records.length])) : "";

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
            {/* The four ways in, standing on a shelf like everything else
                on this page. They used to be flat cards on the panel,
                which meant the page announced itself as a shelving unit
                and then opened with four rectangles. */}
            <div className="woodwall axes">
              <div className="shelf-axes">
                {wall.map((a) => (
                  <Link key={a.id} href={`/shelves?axis=${a.id}`} className="shelf-axis">
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
              {value ? (
                <Link href={`/shelves?axis=${openAxis.id}`}>{openAxis.label}</Link>
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

            {value ? (
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
              />
            ) : (
              <p className="shelf-pick">{openAxis.prompt}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
