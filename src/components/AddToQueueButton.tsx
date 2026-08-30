"use client";

import { useActionState } from "react";
import { addToQueue, type QueueState } from "@/app/actions/queue";
import type { MediaType } from "@/lib/media";

const initialState: QueueState = {};

/**
 * "Up next" on a review card.
 *
 * The most valuable place to add something is the moment somebody's
 * review has just talked you into it - which is also the moment you are
 * least willing to go and find a form. So it is one button, and the
 * review supplies the title, the artist and the artwork.
 *
 * It records which review sent you, so the list can say where a thing
 * came from later, when "why is this on here?" is a real question.
 */
export function AddToQueueButton({
  postId = null,
  mediaType,
  title,
  artist,
  coverUrl,
}: {
  /** The review that sent them, when there is one. The work page has no
   *  single review to credit, so it passes nothing. */
  postId?: string | null;
  mediaType: MediaType;
  title: string;
  artist: string | null;
  coverUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState(addToQueue, initialState);

  return (
    <form action={formAction} className="inline-form">
      <input type="hidden" name="media_type" value={mediaType} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="subtitle" value={artist ?? ""} />
      <input type="hidden" name="image_url" value={coverUrl ?? ""} />
      <input type="hidden" name="from_post_id" value={postId ?? ""} />
      <button type="submit" disabled={pending || state.ok}>
        {state.ok ? "On your list" : pending ? "Adding…" : "Up next"}
      </button>
    </form>
  );
}
