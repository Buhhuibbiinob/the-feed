"use client";

import type { YoutubeVideo } from "@/lib/youtube";

// Asking YouTube less often.
//
// Every search costs 100 units of a 10,000-a-day quota. That is a
// hundred searches for the entire site, across three search boxes and
// everybody using them - which is why a 429 turns up after a couple of
// people look for a song. The debounce was doing its job; the problem
// was how much got through it.
//
// Three things, in order of how much they save:
//
//   1. Nothing under three characters. "l" and "li" cannot return a
//      useful result and cost the same 100 units as a real query.
//   2. 600ms rather than 350. At 350 a normal typing rhythm has pauses
//      in it, and each pause was a search.
//   3. Remember every answer. Backspacing one character and typing it
//      again used to be two more searches for a result already on the
//      screen. The cache is module-level so all three boxes share it,
//      and it lives for the tab rather than forever - long enough to
//      cover the typing, short enough that a search tomorrow is fresh.

export const MIN_QUERY_LENGTH = 3;
export const SEARCH_DEBOUNCE_MS = 600;

export type VideoSearchAnswer = { videos: YoutubeVideo[]; error: string | null };

const cache = new Map<string, VideoSearchAnswer>();
/** Enough for a session's typing; not a memory leak on a long-lived tab. */
const MAX_CACHED = 60;

function remember(key: string, answer: VideoSearchAnswer) {
  // A failure is not worth remembering: a 429 clears on its own, and
  // caching it would keep showing the error after it stopped being true.
  if (answer.error) return;
  if (cache.size >= MAX_CACHED) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, answer);
}

/**
 * One search, cached. Returns null when the query is too short to spend
 * a request on, so callers can tell "not searching" from "found
 * nothing".
 */
export async function searchVideosClient(query: string): Promise<VideoSearchAnswer | null> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return null;

  const key = trimmed.toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;

  try {
    const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(trimmed)}`);
    const data = await res.json();
    const answer: VideoSearchAnswer = {
      videos: Array.isArray(data.videos) ? data.videos : [],
      error: typeof data.error === "string" ? data.error : null,
    };
    remember(key, answer);
    return answer;
  } catch {
    return { videos: [], error: "Couldn't reach the search. Try again in a moment." };
  }
}
