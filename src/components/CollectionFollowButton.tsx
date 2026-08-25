"use client";

import { toggleCollectionFollow } from "@/app/actions/collections";

export function CollectionFollowButton({
  collectionId,
  following,
  count,
}: {
  collectionId: string;
  following: boolean;
  count: number;
}) {
  return (
    <form action={toggleCollectionFollow} className="inline-form">
      <input type="hidden" name="collection_id" value={collectionId} />
      <button type="submit" className={`btn btn-ghost${following ? " following" : ""}`}>
        {following ? "Following" : "Follow"}
        {count > 0 && <> ({count})</>}
      </button>
    </form>
  );
}
