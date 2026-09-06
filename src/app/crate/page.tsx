import { createClient } from "@/lib/supabase/server";
import { guardBuiltinPage } from "@/lib/pages";
import { Crate } from "@/components/Crate";
import { crateSeed, crateSources, fillCrate } from "@/lib/crate";
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
  const pools = await crateSources(seed);
  const sleeves = fillCrate(pools, known, { seed });

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
