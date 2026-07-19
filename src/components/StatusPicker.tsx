"use client";

import { useActionState, useEffect, useState } from "react";
import { setStatus, clearStatus, type ProfileFormState } from "@/app/actions/profile";
import type { SpotifyTrack } from "@/lib/spotify";
import type { YoutubeVideo } from "@/lib/youtube";

const initialState: ProfileFormState = {};

export function StatusPicker({ hasStatus }: { hasStatus: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(setStatus, initialState);
  const [mediaType, setMediaType] = useState<"music" | "movie_tv">("music");
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [selected, setSelected] = useState<SpotifyTrack | null>(null);
  const [searching, setSearching] = useState(false);
  const [videoQuery, setVideoQuery] = useState("");
  const [videoResults, setVideoResults] = useState<YoutubeVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<YoutubeVideo | null>(null);
  const [videoSearching, setVideoSearching] = useState(false);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);

  useEffect(() => {
    if (mediaType !== "music" || !query.trim()) return;
    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (!cancelled) setResults(data.tracks ?? []);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, mediaType]);

  useEffect(() => {
    if (mediaType !== "movie_tv" || !videoQuery.trim()) return;
    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(videoQuery)}`);
        const data = await res.json();
        if (!cancelled) setVideoResults(data.videos ?? []);
      } finally {
        if (!cancelled) setVideoSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [videoQuery, mediaType]);

  if (!open) {
    return (
      <button type="button" className="comment-action" onClick={() => setOpen(true)}>
        {hasStatus ? "Update status" : "Set status"}
      </button>
    );
  }

  return (
    <div className="avatar-picker">
      {state.error && <div className="form-error">{state.error}</div>}
      <form action={formAction} className="comment-form">
        <select
          value={mediaType}
          onChange={(e) => {
            setMediaType(e.target.value as "music" | "movie_tv");
            setSelected(null);
            setSelectedVideo(null);
            setTitle("");
            setQuery("");
            setVideoQuery("");
          }}
        >
          <option value="music">🎧 Listening to…</option>
          <option value="movie_tv">📺 Watching…</option>
        </select>

        {mediaType === "music" ? (
          selected ? (
            <div className="track-selected">
              {selected.imageUrl && <img src={selected.imageUrl} alt="" />}
              <div>
                <b>{selected.name}</b>
                <div className="sub">{selected.artist}</div>
              </div>
              <span
                className="clear"
                onClick={() => {
                  setSelected(null);
                  setTitle("");
                }}
              >
                Clear
              </span>
            </div>
          ) : (
            <div className="track-search">
              <input
                type="text"
                placeholder="Search song or artist…"
                value={query}
                onChange={(e) => {
                  const value = e.target.value;
                  setQuery(value);
                  if (!value.trim()) {
                    setResults([]);
                    setSearching(false);
                  } else {
                    setSearching(true);
                  }
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
                    results.map((track) => (
                      <div
                        className="track-result"
                        key={track.id}
                        onClick={() => {
                          setSelected(track);
                          setTitle(track.name);
                          setQuery("");
                          setResults([]);
                        }}
                      >
                        {track.imageUrl && <img src={track.imageUrl} alt="" />}
                        <div>
                          <b>{track.name}</b>
                          <div className="sub">{track.artist}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        ) : selectedVideo ? (
          <div className="track-selected">
            {selectedVideo.thumbnailUrl && <img src={selectedVideo.thumbnailUrl} alt="" />}
            <div>
              <b>{selectedVideo.title}</b>
              <div className="sub">{selectedVideo.channelTitle}</div>
            </div>
            <span
              className="clear"
              onClick={() => {
                setSelectedVideo(null);
                setTitle("");
              }}
            >
              Clear
            </span>
          </div>
        ) : (
          <div className="track-search">
            <input
              type="text"
              placeholder="Search movie or show title…"
              value={videoQuery}
              onChange={(e) => {
                const value = e.target.value;
                setVideoQuery(value);
                if (!value.trim()) {
                  setVideoResults([]);
                  setVideoSearching(false);
                } else {
                  setVideoSearching(true);
                }
              }}
              autoComplete="off"
            />
            {videoQuery.trim() && (
              <div className="track-results">
                {videoSearching ? (
                  <div className="track-result">Searching…</div>
                ) : videoResults.length === 0 ? (
                  <div className="track-result">No matches.</div>
                ) : (
                  videoResults.map((video) => (
                    <div
                      className="track-result"
                      key={video.id}
                      onClick={() => {
                        setSelectedVideo(video);
                        setTitle(video.title);
                        setVideoQuery("");
                        setVideoResults([]);
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
        )}

        <input type="hidden" name="media_type" value={mediaType} />
        <input type="hidden" name="title" value={title} />
        <input
          type="hidden"
          name="artist"
          value={mediaType === "music" ? selected?.artist ?? "" : selectedVideo?.channelTitle ?? ""}
        />
        <input
          type="hidden"
          name="cover_url"
          value={selected?.imageUrl ?? selectedVideo?.thumbnailUrl ?? ""}
        />

        <div className="form-actions">
          <button className="btn" type="submit" disabled={pending || !title}>
            {pending ? "Saving…" : "Save status"}
          </button>
          <button type="button" className="comment-action" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </form>
      {hasStatus && (
        <form action={clearStatus}>
          <button type="submit" className="comment-action danger">
            Clear status
          </button>
        </form>
      )}
    </div>
  );
}
