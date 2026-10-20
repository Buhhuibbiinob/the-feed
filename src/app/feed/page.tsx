import FeedHome, { type FeedSearchParams } from "./FeedHome";

// The feed, at an address of its own. Until the record store opens to
// everybody it is also the homepage; after that, this is where it lives.
export default function FeedPage({ searchParams }: { searchParams: Promise<FeedSearchParams> }) {
  return <FeedHome searchParams={searchParams} basePath="/feed" />;
}
