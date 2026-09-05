"use client";

import { EmojiText } from "@/lib/emojiText";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signGuestbook, deleteGuestbookEntry, type ModuleFormState } from "@/app/actions/pageModules";

const initialState: ModuleFormState = {};

export type GuestbookEntry = {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorUsername: string;
  authorAvatarUrl: string | null;
};

function when(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * A public wall on a profile, separate from DMs.
 *
 * The owner can delete anything on their own wall, and an author can
 * delete their own entry - the same rules the RLS policy enforces, so the
 * buttons shown here match what the server will actually allow.
 */
export function Guestbook({
  profileId,
  entries,
  currentUserId,
  isOwner,
}: {
  profileId: string;
  entries: GuestbookEntry[];
  currentUserId: string | null;
  isOwner: boolean;
}) {
  const [state, formAction, pending] = useActionState(signGuestbook, initialState);
  const [body, setBody] = useState("");

  const [lastOk, setLastOk] = useState(state.ok);
  if (lastOk !== state.ok) {
    setLastOk(state.ok);
    if (state.ok) setBody("");
  }

  return (
    <div className="guestbook">
      {currentUserId && !isOwner && (
        <form action={formAction} className="comment-form">
          {state.error && <div className="form-error">{state.error}</div>}
          <input type="hidden" name="profile_id" value={profileId} />
          <textarea
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Leave something"
            maxLength={500}
          />
          <div className="form-actions">
            <button className="btn" type="submit" disabled={pending || !body.trim()}>
              {pending ? "Posting…" : "Sign"}
            </button>
          </div>
        </form>
      )}

      {entries.length === 0 ? (
        <div className="empty-state">
          {isOwner ? "Nobody's signed yet." : "Be the first to sign."}
        </div>
      ) : (
        <div className="guestbook-list">
          {entries.map((entry) => (
            <div className="guestbook-entry" key={entry.id}>
              <img src={entry.authorAvatarUrl || "/avatars/preset-1.svg"} alt="" />
              <div className="guestbook-body">
                <div className="guestbook-meta">
                  <Link href={`/profile/${entry.authorUsername}`}>{entry.authorUsername}</Link>
                  <span className="ts">{when(entry.createdAt)}</span>
                </div>
                <div className="guestbook-text">
                  <EmojiText>{entry.body}</EmojiText>
                </div>
              </div>
              {(isOwner || currentUserId === entry.authorId) && (
                <form action={deleteGuestbookEntry}>
                  <input type="hidden" name="id" value={entry.id} />
                  <button type="submit" className="comment-action danger" aria-label="Delete entry">
                    ✕
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
