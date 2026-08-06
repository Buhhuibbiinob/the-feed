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
        <button type="submit">
          {liked ? "Rated" : "Rate"} ({count})
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
