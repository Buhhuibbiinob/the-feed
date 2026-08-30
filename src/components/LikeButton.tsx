import { toggleLike } from "@/app/actions/likes";

export function LikeButton({
  postId,
  liked,
  count,
  asLink = false,
}: {
  postId: string;
  liked: boolean;
  count: number;
  /** Render as a plain underlined text link for the old-blog action row. */
  asLink?: boolean;
}) {
  return (
    <form action={toggleLike} className={asLink ? "inline-form" : undefined}>
      <input type="hidden" name="post_id" value={postId} />
      <input type="hidden" name="liked" value={liked ? "true" : "false"} />
      {asLink ? (
        // "Like", not "Rate". This button toggles a like, the other
        // branch of this same component draws it as a heart, and the
        // alert it produces reads "liked your review" - it was the only
        // thing on the site calling it rating. Rating means something
        // else here: the 1-5 stars a reviewer gives the thing they are
        // reviewing, which is what the leaderboards and For You are
        // built on. One word for two mechanics made both of them
        // vaguer, and it is the reader-facing one that had to give.
        <button type="submit">
          {liked ? "Liked" : "Like"} ({count})
        </button>
      ) : (
        <button type="submit" className={liked ? "like-btn liked" : "like-btn"}>
          <span className="heart">{liked ? "♥" : "♡"}</span>
          <span className="count-badge">{count}</span>
        </button>
      )}
    </form>
  );
}
