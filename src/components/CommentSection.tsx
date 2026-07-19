"use client";

import { useActionState, useState } from "react";
import {
  createComment,
  updateComment,
  deleteComment,
  type CommentFormState,
} from "@/app/actions/comments";

export type CommentData = {
  id: string;
  postId: string;
  userId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  username: string;
  replies: CommentData[];
};

const initialState: CommentFormState = {};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function CommentForm({
  postId,
  parentCommentId,
  onDone,
}: {
  postId: string;
  parentCommentId?: string;
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useActionState(createComment, initialState);
  const [key, setKey] = useState(0);
  const [lastOk, setLastOk] = useState(state.ok);

  if (state.ok !== lastOk) {
    setLastOk(state.ok);
    if (state.ok) {
      setKey((k) => k + 1);
      onDone?.();
    }
  }

  return (
    <form action={formAction} key={key} className="comment-form">
      <input type="hidden" name="post_id" value={postId} />
      {parentCommentId && (
        <input type="hidden" name="parent_comment_id" value={parentCommentId} />
      )}
      {state.error && <div className="form-error">{state.error}</div>}
      <textarea
        name="body"
        placeholder={parentCommentId ? "Write a reply…" : "Add a comment…"}
        required
      />
      <div className="form-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Posting…" : parentCommentId ? "Reply" : "Comment"}
        </button>
      </div>
    </form>
  );
}

function EditForm({ comment, onDone }: { comment: CommentData; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(updateComment, initialState);
  const [lastOk, setLastOk] = useState(state.ok);

  if (state.ok !== lastOk) {
    setLastOk(state.ok);
    if (state.ok) onDone();
  }

  return (
    <form action={formAction} className="comment-form">
      <input type="hidden" name="comment_id" value={comment.id} />
      <input type="hidden" name="post_id" value={comment.postId} />
      {state.error && <div className="form-error">{state.error}</div>}
      <textarea name="body" defaultValue={comment.body} required />
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

function CommentItem({
  comment,
  currentUserId,
  isReply = false,
}: {
  comment: CommentData;
  currentUserId: string | null;
  isReply?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);
  const isOwner = currentUserId === comment.userId;
  const edited = comment.updatedAt !== comment.createdAt;

  return (
    <div className="comment-item">
      {editing ? (
        <EditForm comment={comment} onDone={() => setEditing(false)} />
      ) : (
        <>
          <div className="comment-body">{comment.body}</div>
          <div className="comment-meta">
            <b>{comment.username}</b> · {timeAgo(comment.createdAt)}
            {edited && <> · edited</>}
            {isOwner && (
              <>
                {" "}
                ·{" "}
                <button type="button" className="comment-action" onClick={() => setEditing(true)}>
                  Edit
                </button>{" "}
                ·{" "}
                <form action={deleteComment} className="inline-form">
                  <input type="hidden" name="comment_id" value={comment.id} />
                  <input type="hidden" name="post_id" value={comment.postId} />
                  <button type="submit" className="comment-action danger">
                    Delete
                  </button>
                </form>
              </>
            )}
            {!isReply && currentUserId && (
              <>
                {" "}
                ·{" "}
                <button
                  type="button"
                  className="comment-action"
                  onClick={() => setReplying((r) => !r)}
                >
                  {replying ? "Cancel" : "Reply"}
                </button>
              </>
            )}
          </div>
          {replying && (
            <CommentForm
              postId={comment.postId}
              parentCommentId={comment.id}
              onDone={() => setReplying(false)}
            />
          )}
        </>
      )}
      {comment.replies.length > 0 && (
        <div className="comment-replies">
          {comment.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} currentUserId={currentUserId} isReply />
          ))}
        </div>
      )}
    </div>
  );
}

export function CommentSection({
  postId,
  comments,
  currentUserId,
}: {
  postId: string;
  comments: CommentData[];
  currentUserId: string | null;
}) {
  const total = comments.reduce((n, c) => n + 1 + c.replies.length, 0);

  return (
    <div className="panel">
      <div className="panel-head">Comments ({total})</div>
      <div className="panel-body">
        {currentUserId ? (
          <CommentForm postId={postId} />
        ) : (
          <div className="empty-state">Sign in to leave a comment.</div>
        )}
        {comments.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 12 }}>
            No comments yet — be the first.
          </div>
        ) : (
          <div className="comment-list">
            {comments.map((c) => (
              <CommentItem key={c.id} comment={c} currentUserId={currentUserId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
