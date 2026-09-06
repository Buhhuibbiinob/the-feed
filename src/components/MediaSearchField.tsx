"use client";

import { useEffect, useState } from "react";
import {
  MIN_QUERY_LENGTH,
  SEARCH_DEBOUNCE_MS,
  resolveTrackVideo,
  searchTracksClient,
  type TrackResult,
} from "@/lib/trackSearch";

// A debounced search box over Apple's music catalogue, shared by
// everything on the profile that needs "find a thing and grab its title
// and artwork": the pinned obsession, the profile song, the curated top
// lists and the queue.
//
// It owns only the search - the picked result goes straight back to the
// caller, which decides what to do with it and what hidden fields to
// submit. Keeping the state out of here is what lets one caller store a
// video id and another store just a title and a thumbnail.
//
// It used to search YouTube, which cost 100 quota units per request out
// of 10,000 a day for the whole site, and members were being rate-limited
// mid-word. Only the callers that actually embed something need a video
// id now, and they say so with needsVideo - which turns picking into one
// YouTube lookup, instead of every keystroke being one.
export function MediaSearchField({
  placeholder,
  onPick,
  needsVideo = false,
}: {
  placeholder: string;
  /** `video` is null unless needsVideo was asked for and the lookup found one. */
  onPick: (track: TrackResult, video: { id: string } | null) => void;
  /** For callers that embed the result rather than just naming it. */
  needsVideo?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TrackResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // "Searching" is switched on where the typing happens, not in the effect
  // below: the effect's job is the request, and setting state synchronously
  // in its body just costs an extra render pass to show the same spinner.
  function handleChange(value: string) {
    setQuery(value);
    // Matched to the threshold the effect uses. Anything looser leaves a
    // spinner running for one or two characters that will never be sent.
    setSearching(value.trim().length >= MIN_QUERY_LENGTH);
    if (!value.trim()) setResults([]);
  }

  useEffect(() => {
    // Too short to send. handleChange has already left the spinner off,
    // so there is nothing to undo here.
    if (query.trim().length < MIN_QUERY_LENGTH) return;

    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        const answer = await searchTracksClient(query.trim());
        if (!cancelled && answer) {
          setResults(answer.songs);
          setSearchError(answer.error);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
          setSearchError("Couldn't reach the search. Try again in a moment.");
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

  async function pick(track: TrackResult) {
    if (!needsVideo) {
      onPick(track, null);
      handleChange("");
      return;
    }

    // The one YouTube request. Slow enough to need saying so, and its
    // failure is worth showing rather than swallowing: for a profile
    // song, no video means nothing to play.
    setResolving(true);
    setSearchError(null);
    const { video, error } = await resolveTrackVideo(track);
    setResolving(false);
    if (!video) {
      setSearchError(error);
      return;
    }
    onPick(track, video);
    handleChange("");
  }

  return (
    <div className="track-search">
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        // These search boxes sit inside forms that save something else
        // entirely; Enter here means "I finished typing my query", not
        // "submit the half-filled form around me".
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
        autoComplete="off"
      />
      {query.trim() && (
        <div className="track-results">
          {resolving ? (
            <div className="track-result">Getting it ready…</div>
          ) : searching ? (
            <div className="track-result">Searching…</div>
          ) : results.length === 0 ? (
            <div className="track-result">{searchError ?? "No matches."}</div>
          ) : (
            <>
              {searchError && <div className="track-result">{searchError}</div>}
              {results.map((track) => (
                <div className="track-result" key={track.id} onClick={() => pick(track)}>
                  {track.thumbnailUrl && <img src={track.thumbnailUrl} alt="" />}
                  <div>
                    <b>{track.title}</b>
                    <div className="sub">{track.artist}</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
