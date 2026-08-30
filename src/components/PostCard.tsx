"use client";

import { EmojiText } from "@/lib/emojiText";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { updatePost, deletePost, type PostFormState } from "@/app/actions/posts";
import { LikeButton } from "@/components/LikeButton";
import { PostReactions, type ReactionCount } from "@/components/PostReactions";
import { AddToCollectionButton } from "@/components/AddToCollectionButton";
import { AddToQueueButton } from "@/components/AddToQueueButton";
import { StandaloneGenrePicker } from "@/components/GenrePicker";
import { genreLabel } from "@/lib/genres";
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
  genre?: string | null;
  spotifyTrackId: string | null;
  youtubeVideoId: string | null;
  username: string;
  userId: string;
  isVerified?: boolean;
  /** How many OTHER people have reviewed the same title. Drives the
      "others reviewed this" nudge, which is the cheapest way to turn a
      dead Comment (0) into a reason to open the post. */
  alsoReviewedCount?: number;
  /** The thing this review is about, when it has been resolved to one. */
  workId?: string | null;
  /** The author's earned rank (Regular, Critic, Tastemaker...). Already
      computed for profiles; surfacing it in the feed is what makes the
      ladder worth climbing. */
  authorRank?: string | null;
  /** The author's banner, shown as a strip behind their name. A username
      alone gives nobody a reason to open a profile; a glimpse of the page
      someone made does. */
  authorBannerUrl?: string | null;
  authorAvatarUrl?: string | null;
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
      {/* Not required: a rating on its own is a valid post, so demanding
          text here would let someone open a rating-only post for editing
          and then refuse to save it, with nothing wrong with it. The
          server enforces the real rule - words or a rating, either. */}
      <textarea name="body" defaultValue={post.body} placeholder="Say something (optional)" />
      {/* Where an older review gets a genre: its author is the only
          person who knows, and this is the only place they're asked. */}
      <StandaloneGenrePicker mediaType={post.mediaType} initial={post.genre ?? null} />
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
  viewerIsAdmin = false,
  liked,
  likeCount,
  commentCount,
  hideCommentLink = false,
  sticker,
  previewId,
  reactions,
  myReaction = null,
  answering = null,
}: {
  post: PostCardData;
  currentUserId: string | null;
  /** Lets an admin remove anyone's post from wherever it appears. The
   *  server action enforces this too - this only decides what's shown. */
  viewerIsAdmin?: boolean;
  liked: boolean;
  likeCount: number;
  commentCount: number;
  hideCommentLink?: boolean;
  sticker?: "hot" | "new";
  previewId?: string;
  /** Left out on the surfaces that have not been wired for reactions
   *  yet, where the row simply does not appear rather than the card
   *  failing to render. */
  reactions?: ReactionCount[];
  myReaction?: string | null;
  /** Set when this post answers another one. */
  answering?: { id: string; title: string; username: string } | null;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteFormRef = useRef<HTMLFormElement>(null);
  const isOwner = currentUserId === post.userId;
  const canDelete = isOwner || viewerIsAdmin;
  const canEdit = isOwner || viewerIsAdmin;

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
            <EmojiText>{post.title}</EmojiText>
            {post.artist && <> - {post.artist}</>}
          </Link>
          <div className="track-actions">
            {/* Built as a list so a pipe only ever appears BETWEEN two real
                items. Hard-coding separators around a conditional item
                leaves a stray "| |" whenever that item is hidden. */}
            {[
              currentUserId ? (
                <LikeButton key="rate" postId={post.id} liked={liked} count={likeCount} asLink />
              ) : (
                <span key="rate" className="track-actions-muted">Like ({likeCount})</span>
              ),
              hideCommentLink ? null : (
                <Link key="comment" href={`/post/${post.id}`} className={commentCount === 0 ? "comment-invite" : undefined}>
                  {commentCount === 0 ? "Be the first to comment" : `Comment (${commentCount})`}
                </Link>
              ),
              currentUserId ? <AddToCollectionButton key="save" postId={post.id} asLink /> : null,
              // Save keeps the review; this keeps the THING, on a list of
              // what you mean to get to. Not offered on your own review,
              // where queueing what you just reviewed is nonsense.
              currentUserId && !isOwner ? (
                <AddToQueueButton
                  key="queue"
                  postId={post.id}
                  mediaType={post.mediaType}
                  title={post.title}
                  artist={post.artist}
                  coverUrl={post.coverUrl}
                />
              ) : null,
              // Answering your own review is a loop with nobody in it.
              currentUserId && !isOwner ? (
                <Link key="duet" href={`/post/new?responds_to=${post.id}`}>
                  Answer with yours
                </Link>
              ) : null,
              <ShareButton
                key="share"
                postId={post.id}
                title={`${post.title}${post.artist ? ` - ${post.artist}` : ""}`}
                asLink
              />,
              canEdit ? (
                <button key="edit" type="button" onClick={() => setEditing(true)}>
                  {isOwner ? "Edit" : "Edit (admin)"}
                </button>
              ) : null,
              canDelete ? (
                <form key="delete" action={deletePost} className="inline-form" ref={deleteFormRef}>
                  <input type="hidden" name="post_id" value={post.id} />
                  <button type="button" className="danger" onClick={() => setConfirmingDelete(true)}>
                    {isOwner ? "Delete" : "Delete (admin)"}
                  </button>
                </form>
              ) : null,
            ]
              .filter(Boolean)
              .map((item, i) => (
                <span className="track-action-item" key={i}>
                  {i > 0 && <span className="sep">|</span>}
                  {item}
                </span>
              ))}
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
        {answering && (
          /* Above the badge, because "this is an answer" changes how you
             read everything under it. */
          <Link href={`/post/${answering.id}`} className="duet-ref">
            ↩ answering <b>{answering.username}</b> on {answering.title}
          </Link>
        )}
        <span className={`badge ${post.mediaType}`}>{MEDIA_LABELS[post.mediaType]}</span>
        {/* A link, not a label. A genre you can't click is a genre nobody
            has a reason to set - this is the whole payoff for filling the
            field in, and the only thing that will get it filled in. */}
        {post.genre && (
          <Link href={`/?type=${post.mediaType}&genre=${post.genre}#reviews`} className="badge genre">
            {genreLabel(post.genre)}
          </Link>
        )}
        {(post.spotifyTrackId || post.youtubeVideoId) && (
          <div id={previewId}>
            <PreviewPlayer
              spotifyTrackId={post.spotifyTrackId}
              youtubeVideoId={post.youtubeVideoId}
              label={post.title}
            />
          </div>
        )}
        {/* For a photography post the image IS the review's subject, so it
            gets shown full width instead of only as the 46px row thumbnail
            that music and film posts use for their cover art. */}
        {post.mediaType === "photography" && post.coverUrl && (
          <div className="post-photo">
            <img src={post.coverUrl} alt={post.title} loading="lazy" />
          </div>
        )}
        {/* A rating on its own is a whole post now, so the body is only
            rendered when there is one - otherwise every logged rating
            left an empty gap where the words would have been. */}
        {post.body.trim() && <SpoilerText text={post.body} />}
        {reactions && (
          <PostReactions
            postId={post.id}
            counts={reactions}
            mine={myReaction}
            signedIn={currentUserId !== null}
          />
        )}
        <div className="post-meta">
          <Link
            href={`/profile/${post.username}`}
            className="post-author"
            style={
              post.authorBannerUrl
                ? { backgroundImage: `url(${post.authorBannerUrl})` }
                : undefined
            }
          >
            {post.authorAvatarUrl && (
              <img src={post.authorAvatarUrl} alt="" className="post-author-avatar" />
            )}
            <span>{post.username}</span>
          </Link>
          {post.isVerified && <VerifiedBadge />}
          {post.authorRank && <span className="author-rank">{post.authorRank}</span>} ·{" "}
          {timeAgo(post.createdAt)}
          {/* Points at the thing itself now, where all of those reviews
              and their average are, rather than at this one review's
              comments - which was the best available answer before works
              existed. Falls back to the post when the review has not been
              linked to a work yet. */}
          {(post.alsoReviewedCount ?? 0) > 0 && (
            <Link
              href={post.workId ? `/work/${post.workId}` : `/post/${post.id}`}
              className="also-reviewed"
            >
              {post.alsoReviewedCount} other{post.alsoReviewedCount === 1 ? "" : "s"} reviewed this
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
