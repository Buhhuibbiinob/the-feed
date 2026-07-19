"use client";

import { useActionState } from "react";
import {
  addArtistPostComment,
  deleteArtistPostComment,
  type ArtistCommentFormState,
} from "@/app/actions/artistPosts";
import { adminDeleteArtistComment } from "@/app/actions/admin";

export type ArtistCommentData = {
  id: string;
  userId: string;
  username: string;
  body: string;
  createdAt: string;
};

const initialState: ArtistCommentFormState = {};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ArtistPostComments({
  postId,
  comments,
  currentUserId,
  isAdmin = false,
}: {
  postId: string;
  comments: ArtistCommentData[];
  currentUserId: string | null;
  isAdmin?: boolean;
}) {
  const [state, formAction, pending] = useActionState(addArtistPostComment, initialState);

  return (
    <div className="panel">
      <div className="panel-head">Replies ({comments.length})</div>
      <div className="panel-body">
        {currentUserId ? (
          <form action={formAction} className="comment-form">
            <input type="hidden" name="post_id" value={postId} />
            {state.error && <div className="form-error">{state.error}</div>}
            <textarea name="body" placeholder="Reply to this post…" required />
            <div className="form-actions">
              <button className="btn" type="submit" disabled={pending}>
                {pending ? "Posting…" : "Reply"}
              </button>
            </div>
          </form>
        ) : (
          <div className="empty-state">Sign in to reply.</div>
        )}
        {comments.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 12 }}>
            No replies yet — be the first.
          </div>
        ) : (
          <div className="comment-list">
            {comments.map((c) => (
              <div className="comment-item" key={c.id}>
                <div className="comment-body">{c.body}</div>
                <div className="comment-meta">
                  <b>{c.username}</b> · {timeAgo(c.createdAt)}
                  {(currentUserId === c.userId || isAdmin) && (
                    <>
                      {" "}
                      ·{" "}
                      <form
                        action={currentUserId === c.userId ? deleteArtistPostComment : adminDeleteArtistComment}
                        className="inline-form"
                      >
                        <input type="hidden" name="comment_id" value={c.id} />
                        <input type="hidden" name="post_id" value={postId} />
                        <button type="submit" className="comment-action danger">
                          Delete
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
