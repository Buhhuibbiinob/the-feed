import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStoreAccess } from "@/lib/storeAccess";
import { loadStoreSnapshot } from "@/lib/storeData";
import { STORE_FONT_VARIABLES } from "@/lib/storeFonts";
import { StoreCountdown } from "@/components/store/StoreCountdown";
import { StoreClient } from "@/components/store/StoreClient";
import FeedHome, { type FeedSearchParams } from "./feed/FeedHome";

// The homepage, which is becoming the record store.
//
//   An admin:             the store, now.
//   Everybody else:       the feed, as it has always been - with a
//                         countdown across the top once an admin has
//                         started one - until the launch time passes.
//   After launch:         the store, for everybody.
//
// The feed itself is untouched and lives at /feed either way. Old links
// into it (/?filter=following, /?type=music&page=2) keep working: once the
// store is the homepage, they are sent on to /feed.
//
// Which page renders is decided here, on the server, from the server's
// clock - not in the browser, where a clock can be wound forward. And
// this only decides the page: the store's database functions check the
// same rule again on every write.
export const dynamic = "force-dynamic";

const FEED_PARAMS = ["filter", "type", "page", "genre", "view"] as const;

export default async function Home({ searchParams }: { searchParams: Promise<FeedSearchParams> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const access = await getStoreAccess(supabase, user?.id ?? null);

  if (access.open) {
    const params = await searchParams;
    const feedQuery = new URLSearchParams();
    for (const key of FEED_PARAMS) {
      const value = params[key];
      if (typeof value === "string" && value) feedQuery.set(key, value);
    }
    if (feedQuery.size > 0) redirect(`/feed?${feedQuery.toString()}`);

    let username: string | null = null;
    if (user) {
      const { data } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
      username = (data?.username as string) ?? null;
    }
    const snapshot = await loadStoreSnapshot(
      supabase,
      user ? { id: user.id, username, isAdmin: access.isAdmin } : null
    );
    if (snapshot) {
      return (
        <StoreClient
          initial={snapshot}
          launchAt={access.launchAt?.toISOString() ?? null}
          serverNow={new Date().toISOString()}
          fontClass={STORE_FONT_VARIABLES}
        />
      );
    }
    // The tables are not there yet: migration 022 has not been run. Only
    // an admin can be here before launch, so say so plainly and keep the
    // feed underneath.
    return (
      <>
        {access.isAdmin && (
          <p className="store-setup-note" role="status">
            The record store is switched on for you but its database tables are missing. Run
            supabase/migrations/022-store.sql in the Supabase SQL editor, then reload.
          </p>
        )}
        <FeedHome searchParams={searchParams} basePath="/" />
      </>
    );
  }

  return (
    <>
      {access.counting && access.launchAt && (
        <div className={STORE_FONT_VARIABLES}>
          <StoreCountdown launchAt={access.launchAt.toISOString()} serverNow={new Date().toISOString()} />
        </div>
      )}
      <FeedHome searchParams={searchParams} basePath="/" />
    </>
  );
}
