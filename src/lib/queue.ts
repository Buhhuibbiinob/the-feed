import type { MediaType } from "@/lib/media";

// "Up Next" - the things somebody means to get to.
//
// Not the same object as a collection, and worth being clear about why,
// because the two look alike from a distance. A collection is a public,
// named list of REVIEWS other people wrote: it can only ever contain
// things this site has already discussed. This is a private list of
// THINGS, most of which nobody here has reviewed - the whole point is
// that it exists before the review does.
//
// Which makes it the other half of the loop the post confirmation
// started. That one gives you something to do after you review. This one
// gives you something to review when you next turn up.

export const MAX_QUEUE = 100;

export type QueueItem = {
  id: string;
  mediaType: MediaType;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  fromPostId: string | null;
  doneAt: string | null;
  createdAt: string;
};

export type QueueRow = {
  id: string;
  media_type: MediaType;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  from_post_id: string | null;
  done_at: string | null;
  created_at: string;
};

export function toQueueItem(row: QueueRow): QueueItem {
  return {
    id: row.id,
    mediaType: row.media_type,
    title: row.title,
    subtitle: row.subtitle,
    imageUrl: row.image_url,
    fromPostId: row.from_post_id,
    doneAt: row.done_at,
    createdAt: row.created_at,
  };
}

/**
 * The whole "I've done this one" label per category, not a verb stem.
 *
 * Stems plus "ed it" gave "Look ated it" for photography and "Listened
 * it" for music. English does not conjugate by string concatenation.
 */
export const QUEUE_DONE_LABEL: Record<MediaType, string> = {
  music: "Heard it",
  movie_tv: "Watched it",
  photography: "Seen it",
};

/**
 * The composer, pre-filled from a queue item.
 *
 * The item id rides along so that posting the review can tick the thing
 * off by itself. Asking somebody to write the review and then go back and
 * tick the box is asking them to do the same job twice, and the second
 * half is the half that gets skipped - which would leave the list slowly
 * filling with things they had already done.
 */
export function reviewHref(item: QueueItem): string {
  const params = new URLSearchParams({
    type: item.mediaType,
    title: item.title,
    queue: item.id,
  });
  if (item.subtitle) params.set("artist", item.subtitle);
  return `/post/new?${params.toString()}`;
}
