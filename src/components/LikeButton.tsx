import { toggleLike } from "@/app/actions/likes";

export function LikeButton({
  postId,
  liked,
  count,
}: {
  postId: string;
  liked: boolean;
  count: number;
}) {
  return (
    <form action={toggleLike}>
      <input type="hidden" name="post_id" value={postId} />
      <input type="hidden" name="liked" value={liked ? "true" : "false"} />
      <button type="submit" className={liked ? "like-btn liked" : "like-btn"}>
        <span className="heart">{liked ? "♥" : "♡"}</span>
        <span>{count}</span>
      </button>
    </form>
  );
}
