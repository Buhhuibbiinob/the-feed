"use client";

import { useEffect, useState } from "react";
import type { YoutubeVideo } from "@/lib/youtube";

// A debounced search box over the YouTube catalogue, shared by everything
// on the profile that needs "find a thing and grab its title and artwork":
// the pinned obsession, the profile song, and the curated top lists.
//
// It owns only the search - the picked result goes straight back to the
// caller, which decides what to do with it and what hidden fields to
// submit. Keeping the state out of here is what lets one caller store a
// video id and another store just a title and a thumbnail.
export function MediaSearchField({
  placeholder,
  onPick,
}: {
  placeholder: string;
  onPick: (video: YoutubeVideo) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<YoutubeVideo[]>([]);
  const [searching, setSearching] = useState(false);

  // "Searching" is switched on where the typing happens, not in the effect
  // below: the effect's job is the request, and setting state synchronously
  // in its body just costs an extra render pass to show the same spinner.
  function handleChange(value: string) {
    setQuery(value);
    setSearching(!!value.trim());
    if (!value.trim()) setResults([]);
  }

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;

    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (!cancelled) setResults(data.videos ?? []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query]);

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
          {searching ? (
            <div className="track-result">Searching…</div>
          ) : results.length === 0 ? (
            <div className="track-result">No matches.</div>
          ) : (
            results.map((video) => (
              <div
                className="track-result"
                key={video.id}
                onClick={() => {
                  onPick(video);
                  handleChange("");
                }}
              >
                {video.thumbnailUrl && <img src={video.thumbnailUrl} alt="" />}
                <div>
                  <b>{video.title}</b>
                  <div className="sub">{video.channelTitle}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
