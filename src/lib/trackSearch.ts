"use client";

import { searchVideosClient } from "@/lib/videoSearch";
import type { YoutubeVideo } from "@/lib/youtube";

// Searching for a song without spending a quota on every keystroke.
//
// The old version asked YouTube. Every request cost 100 units of a
// 10,000-a-day allowance - a hundred searches for the entire site, shared
// between four search boxes and everybody using them - so members were
// being told to "wait a few seconds" halfway through typing an artist's
// name. The debounce, the three-character floor and the cache were all
// doing their jobs; there was simply no budget for a search box.
//
// So the typing goes to Apple's catalogue, which is free, keyless and
// better at music than YouTube is. YouTube is asked exactly once, for the
// result somebody actually picked, because an embed still needs a video
// id. That is about one request per song added rather than one per pause
// in somebody's typing.

export const MIN_QUERY_LENGTH = 3;
export const SEARCH_DEBOUNCE_MS = 400;

/** A song someone can pick, before anything has been resolved to play it. */
export type TrackResult = {
  /** Apple's track id. Unique within a result list; never a YouTube id. */
  id: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  /** Apple's 30-second clip, where the catalogue has one. */
  previewUrl: string | null;
};

export type TrackSearchAnswer = { songs: TrackResult[]; error: string | null };

const cache = new Map<string, TrackSearchAnswer>();
/** Enough for a session's typing; not a memory leak on a long-lived tab. */
const MAX_CACHED = 60;

function remember(key: string, answer: TrackSearchAnswer) {
  // A failure is not worth remembering: it clears on its own, and caching
  // it would keep showing the error after it stopped being true.
  if (answer.error) return;
  if (cache.size >= MAX_CACHED) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, answer);
}

/**
 * One search, cached. Returns null when the query is too short to bother
 * with, so callers can tell "not searching" from "found nothing".
 *
 * The debounce and the floor are kept even though the catalogue is free.
 * They are no longer about money - they are about not repainting the
 * results under somebody's fingers while they are still typing.
 */
export async function searchTracksClient(query: string): Promise<TrackSearchAnswer | null> {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return null;

  const key = trimmed.toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;

  try {
    const res = await fetch(`/api/music/search?q=${encodeURIComponent(trimmed)}`);
    const data = await res.json();
    const answer: TrackSearchAnswer = {
      songs: Array.isArray(data.songs) ? data.songs : [],
      error: typeof data.error === "string" ? data.error : null,
    };
    remember(key, answer);
    return answer;
  } catch {
    return { songs: [], error: "Couldn't reach the search. Try again in a moment." };
  }
}

export type ResolvedTrack = { video: YoutubeVideo | null; error: string | null };

/**
 * Finds the video for a chosen song, so it can be embedded.
 *
 * Called once per pick. A failure here is not fatal for everything: a
 * queue item or a favourite is a title and a picture and does not need a
 * video at all. It is fatal for a profile song, which is why the answer
 * carries the reason rather than just coming back empty.
 */
export async function resolveTrackVideo(track: TrackResult): Promise<ResolvedTrack> {
  const params = new URLSearchParams({ title: track.title, artist: track.artist });
  try {
    const res = await fetch(`/api/youtube/resolve?${params.toString()}`);
    const data = await res.json();
    const videos: YoutubeVideo[] = Array.isArray(data.videos) ? data.videos : [];
    const error = typeof data.error === "string" ? data.error : null;
    if (videos.length > 0) return { video: videos[0], error: null };
    // Named for what it is: YouTube had nothing for THIS one. The old
    // wording was "couldn't find anything playable for that song", which
    // was shown at the top of a list that had the song in it four times
    // - so it read as "this song does not exist" about a song visibly
    // right there, and the only sensible response to it was confusion.
    return {
      video: null,
      error:
        error ??
        `No video on YouTube for "${track.title}". Another version below may have one.`,
    };
  } catch {
    return { video: null, error: "Couldn't reach the search. Try again in a moment." };
  }
}

/** A search result from either catalogue, in one shape. */
export type MediaResult = {
  /** Empty until something has been matched to a playable video. */
  youtubeId: string;
  title: string;
  subtitle: string;
  thumbnailUrl: string | null;
};

export type MediaSearchAnswer = { results: MediaResult[]; error: string | null };

/**
 * The search behind the composer and the status box, which both cover
 * every category rather than music alone.
 *
 * Songs go to Apple - free, keyless, and better at music. Films and shows
 * stay on YouTube, because what that box is looking for is a trailer, and
 * a trailer is a YouTube thing.
 */
export async function searchMediaClient(
  query: string,
  { music }: { music: boolean }
): Promise<MediaSearchAnswer | null> {
  if (music) {
    const answer = await searchTracksClient(query);
    if (!answer) return null;
    return {
      results: answer.songs.map((song) => ({
        youtubeId: "",
        title: song.title,
        subtitle: song.artist,
        thumbnailUrl: song.thumbnailUrl,
      })),
      error: answer.error,
    };
  }

  const answer = await searchVideosClient(query);
  if (!answer) return null;
  return {
    results: answer.videos.map((video) => ({
      youtubeId: video.id,
      title: video.title,
      subtitle: video.channelTitle,
      thumbnailUrl: video.thumbnailUrl,
    })),
    error: answer.error,
  };
}
