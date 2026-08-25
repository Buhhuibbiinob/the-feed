"use client";

import { togglePinnedPost } from "@/app/actions/pageModules";

// Shown to a review's author only. Featuring somebody else's review on your
// own profile would read as yours, so the server checks authorship too.
export function PinReviewButton({ postId, pinned }: { postId: string; pinned: boolean }) {
  return (
    <form action={togglePinnedPost} className="inline-form">
      <input type="hidden" name="post_id" value={postId} />
      <button type="submit" className="comment-action">
        {pinned ? "Unfeature from profile" : "Feature on profile"}
      </button>
    </form>
  );
}
