"use client";

import Link from "next/link";
import { useActionState } from "react";
import { keepHandoff, type HandoffState } from "@/app/actions/handoffs";
import type { Handoff } from "@/lib/handoffs";

const initialState: HandoffState = {};

/**
 * What people have handed you.
 *
 * Above the alerts rather than among them. A like is a tap and belongs
 * in a list of taps; somebody choosing one record, choosing you, and
 * writing a line about why is not the same kind of event and reads
 * wrong squeezed into the same row height.
 */
function KeepButton({ handoff }: { handoff: Handoff }) {
  const [state, formAction, pending] = useActionState(keepHandoff, initialState);
  const kept = !!handoff.keptAt || state.ok;

  return (
    <form action={formAction} className="inline-form">
      <input type="hidden" name="handoff_id" value={handoff.id} />
      <button type="submit" disabled={pending || kept}>
        {kept ? "You took it" : pending ? "Taking it…" : "I'll take it"}
      </button>
    </form>
  );
}

export function HandedToYou({ handoffs }: { handoffs: Handoff[] }) {
  if (handoffs.length === 0) return null;

  return (
    <div className="panel">
      <div className="panel-head">Handed to you</div>
      <div className="panel-body handed-list">
        {handoffs.map((handoff) => (
          <article key={handoff.id} className="handed">
            <Link href={`/post/${handoff.postId}`} className="handed-art">
              {handoff.coverUrl ? (
                <img src={handoff.coverUrl} alt="" />
              ) : (
                <span className="handed-blank" aria-hidden="true" />
              )}
            </Link>

            <div className="handed-body">
              <div className="handed-from">
                <Link href={`/profile/${handoff.fromUsername}`}>{handoff.fromUsername}</Link>{" "}
                handed you
              </div>
              <Link href={`/post/${handoff.postId}`} className="handed-title">
                {handoff.postTitle}
                {handoff.postArtist && <span> — {handoff.postArtist}</span>}
              </Link>
              {/* The note in their words, in quotes, because it is the
                  part a machine could never have produced. */}
              {handoff.note && <p className="handed-note">“{handoff.note}”</p>}
              <div className="handed-actions">
                <KeepButton handoff={handoff} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
