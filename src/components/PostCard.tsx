"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { updatePost, deletePost, type PostFormState } from "@/app/actions/posts";
import { LikeButton } from "@/components/LikeButton";
import { AddToCollectionButton } from "@/components/AddToCollectionButton";
import { ShareButton } from "@/components/ShareButton";
import { PreviewPlayer } from "@/components/PreviewPlayer";
import { SpoilerText } from "@/components/SpoilerText";
import { AlertModal } from "@/components/AlertModal";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { MEDIA_LABELS, type MediaType } from "@/lib/media";
import { Stars } from "@/components/Stars";

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
  isVerified?: boolean;
};

const initialState: PostFormState = {};

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
  sticker,
  previewId,
}: {
  post: PostCardData;
  currentUserId: string | null;
  liked: boolean;
  likeCount: number;
  commentCount: number;
  hideCommentLink?: boolean;
  sticker?: "hot" | "new";
  previewId?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteFormRef = useRef<HTMLFormElement>(null);
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
      {sticker === "hot" && <span className="sticker-badge hot">hot take</span>}
      {sticker === "new" && <span className="sticker-badge new">new fave</span>}
      <div className="track-row">
        <div
          className="track-thumb"
          style={post.coverUrl ? { backgroundImage: `url(${post.coverUrl})` } : undefined}
        />
        <div className="track-body">
          <Link href={`/post/${post.id}`} className="track-title">
            {post.title}
            {post.artist && <> - {post.artist}</>}
          </Link>
          <div className="track-actions">
            {currentUserId ? (
              <LikeButton postId={post.id} liked={liked} count={likeCount} asLink />
            ) : (
              <span className="track-actions-muted">Rate ({likeCount})</span>
            )}
            <span className="sep">|</span>
            {!hideCommentLink && (
              <Link href={`/post/${post.id}`}>Comment ({commentCount})</Link>
            )}
            <span className="sep">|</span>
            <ShareButton postId={post.id} title={`${post.title}${post.artist ? ` - ${post.artist}` : ""}`} asLink />
            {currentUserId && (
              <>
                <span className="sep">|</span>
                <AddToCollectionButton postId={post.id} asLink />
              </>
            )}
            {isOwner && (
              <>
                <span className="sep">|</span>
                <button type="button" onClick={() => setEditing(true)}>
                  Edit
                </button>
                <span className="sep">|</span>
                <form action={deletePost} className="inline-form" ref={deleteFormRef}>
                  <input type="hidden" name="post_id" value={post.id} />
                  <button type="button" className="danger" onClick={() => setConfirmingDelete(true)}>
                    Delete
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
        {post.rating && <div className="track-stars"><Stars rating={post.rating} /></div>}
      </div>
      {confirmingDelete && (
        <AlertModal
          title="Delete Review"
          message={`Delete "${post.title}"? This can't be undone.`}
          confirmLabel="Delete"
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => {
            setConfirmingDelete(false);
            deleteFormRef.current?.requestSubmit();
          }}
        />
      )}
      <div className="post-card-body">
        <span className={`badge ${post.mediaType}`}>{MEDIA_LABELS[post.mediaType]}</span>
        {(post.spotifyTrackId || post.youtubeVideoId) && (
          <div id={previewId}>
            <PreviewPlayer
              spotifyTrackId={post.spotifyTrackId}
              youtubeVideoId={post.youtubeVideoId}
              label={post.title}
            />
          </div>
        )}
        <SpoilerText text={post.body} />
        <div className="post-meta">
          <Link href={`/profile/${post.username}`}>{post.username}</Link>
          {post.isVerified && <VerifiedBadge />} · {timeAgo(post.createdAt)}
        </div>
      </div>
    </div>
  );
}
