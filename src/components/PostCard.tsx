"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { updatePost, deletePost, type PostFormState } from "@/app/actions/posts";
import { LikeButton } from "@/components/LikeButton";
import { PreviewPlayer } from "@/components/PreviewPlayer";
import { SpoilerText } from "@/components/SpoilerText";
import { MEDIA_LABELS, type MediaType } from "@/lib/media";

export type PostCardData = {
  id: string;
  mediaType: MediaType;
  title: string;
  body: string;
  rating: number | null;
  createdAt: string;
  artist: string | null;
  coverUrl: string | null;
  spotifyTrackId: string | null;
  youtubeVideoId: string | null;
  username: string;
  userId: string;
};

const initialState: PostFormState = {};

function stars(rating: number | null) {
  if (!rating) return null;
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function EditForm({ post, onDone }: { post: PostCardData; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(updatePost, initialState);
  const [lastOk, setLastOk] = useState(state.ok);

  if (state.ok !== lastOk) {
    setLastOk(state.ok);
    if (state.ok) onDone();
  }

  return (
    <form action={formAction} className="comment-form">
      <input type="hidden" name="post_id" value={post.id} />
      {state.error && <div className="form-error">{state.error}</div>}
      <input name="title" defaultValue={post.title} required />
      <textarea name="body" defaultValue={post.body} required />
      <select name="rating" defaultValue={post.rating ?? ""}>
        <option value="">No rating</option>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {n} star{n === 1 ? "" : "s"}
          </option>
        ))}
      </select>
      <div className="form-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" className="comment-action" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function PostCard({
  post,
  currentUserId,
  liked,
  likeCount,
  commentCount,
  hideCommentLink = false,
}: {
  post: PostCardData;
  currentUserId: string | null;
  liked: boolean;
  likeCount: number;
  commentCount: number;
  hideCommentLink?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const isOwner = currentUserId === post.userId;

  if (editing) {
    return (
      <div className="post-card">
        <EditForm post={post} onDone={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <div className="post-card">
      <div className="post-card-head">
        {post.coverUrl && <img src={post.coverUrl} alt="" className="cover-thumb" />}
        <span className={`badge ${post.mediaType}`}>{MEDIA_LABELS[post.mediaType]}</span>
        <span className="title">
          {post.title}
          {post.artist && <> — {post.artist}</>}
        </span>
        {post.rating && <span className="stars">{stars(post.rating)}</span>}
      </div>
      {(post.spotifyTrackId || post.youtubeVideoId) && (
        <PreviewPlayer
          spotifyTrackId={post.spotifyTrackId}
          youtubeVideoId={post.youtubeVideoId}
          label={post.title}
        />
      )}
      <div className="post-card-body">
        <SpoilerText text={post.body} />
        <div className="post-meta">
          <Link href={`/profile/${post.username}`} className="comment-action">
            {post.username}
          </Link>{" "}
          · {timeAgo(post.createdAt)}
          {isOwner && (
            <>
              {" "}
              ·{" "}
              <button type="button" className="comment-action" onClick={() => setEditing(true)}>
                Edit
              </button>{" "}
              ·{" "}
              <form action={deletePost} className="inline-form">
                <input type="hidden" name="post_id" value={post.id} />
                <button type="submit" className="comment-action danger">
                  Delete
                </button>
              </form>
            </>
          )}
        </div>
      </div>
      <div className="post-actions">
        {currentUserId ? (
          <LikeButton postId={post.id} liked={liked} count={likeCount} />
        ) : (
          <span className="like-btn">
            <span className="heart">♡</span>
            <span>{likeCount}</span>
          </span>
        )}
        {!hideCommentLink && (
          <Link href={`/post/${post.id}`} className="comment-link">
            {commentCount} comment{commentCount === 1 ? "" : "s"}
          </Link>
        )}
      </div>
    </div>
  );
}
