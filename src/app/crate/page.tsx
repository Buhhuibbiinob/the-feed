import { createClient } from "@/lib/supabase/server";
import { guardBuiltinPage } from "@/lib/pages";
import { Crate } from "@/components/Crate";
import { FILMS_PER_CRATE, crateSeed, crateSources, fillCrate, mixInFilms, type Sleeve } from "@/lib/crate";
import { screenFinds } from "@/lib/trailers";
import { searchVideosDetailed } from "@/lib/youtube";
import { alreadyKnown, describeDiscoveryStatus, discoveryStatus, type SeedPost } from "@/lib/musicDiscovery";

export const metadata = { title: "The Crate on Feedback" };

/**
 * A box of records to go through.
 *
 * The one page on the site that is not trying to be right. Discover
 * ranks, the feed ranks, the charts rank; this hands over thirty sleeves
 * in no order and lets somebody decide. Most of them will be wrong, which
 * is what makes the one that isn't worth having found rather than been
 * given.
 */
export default async function CratePage() {
  const supabase = await createClient();
  await guardBuiltinPage(supabase, "crate");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The only thing the crate knows about the digger: what they have
  // already written about, so those records can be taken out. No seeds,
  // no taste profile, nothing to walk outward from.
  const { data: myPosts } = user
    ? await supabase
        .from("posts")
        .select("media_type, title, artist, rating")
        .eq("user_id", user.id)
        .returns<SeedPost[]>()
    : { data: null };
  const known = alreadyKnown(myPosts ?? []);

  const seed = crateSeed(new Date(), user?.id ?? null);
  const [pools, screen] = await Promise.all([
    crateSources(seed),
    // Films in the box. A crate in a shop is not sorted by medium, and
    // the moment you hit a film it is a different decision from the
    // record before it, which is most of why digging through one is
    // worth doing. One lane's worth, rotated by the same seed as the
    // records so the whole box changes together.
    // Films, but not at the cost of the crate.
    //
    // The box is records; the films are the surprise in it. This used to
    // be awaited flat alongside the records, so a slow or throttled
    // YouTube held up the whole crate - and on a cold cache screenFinds
    // can try three lanes one after another. Whatever has not arrived in
    // two and a half seconds is a crate of records instead of a crate of
    // records and films, which is a far better answer than a spinner.
    Promise.race([
      screenFinds(myPosts ?? [], known, searchVideosDetailed, {
        limit: FILMS_PER_CRATE,
        rotateBy: seed,
      }).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
    ]),
  ]);
  const records = fillCrate(pools, known, { seed });
  const films: Sleeve[] = (screen?.finds ?? []).map((find) => ({
    key: find.key,
    name: find.title,
    artist: find.year ?? find.channel,
    imageUrl: find.imageUrl,
    // A film has no thirty second clip, it has a trailer, and the card
    // plays that instead.
    previewUrl: null,
    storeUrl: null,
    kind: "film",
    videoId: find.videoId,
  }));
  const sleeves = mixInFilms(records, films, seed);

  const status = discoveryStatus([sleeves.length]);

  return (
    <div className="panel">
      <div className="panel-head">The Crate</div>
      <div className="panel-body">
        <p className="crate-intro">
          Thirty records, in no particular order. Nothing here was chosen for you - it&apos;s
          pulled from scenes and decades at random, minus anything you&apos;ve already reviewed.
          Most of it won&apos;t be for you. That&apos;s the idea.
        </p>
        <Crate
          sleeves={sleeves}
          emptyNote={
            describeDiscoveryStatus(status) ||
            "The crate came back empty this time. Try again in a moment."
          }
        />
      </div>
    </div>
  );
}
