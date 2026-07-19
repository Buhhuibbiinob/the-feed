"use client";

import { useActionState, useEffect, useState } from "react";
import { setStatus, clearStatus, type ProfileFormState } from "@/app/actions/profile";
import type { YoutubeVideo } from "@/lib/youtube";

const initialState: ProfileFormState = {};

export function StatusPicker({ hasStatus }: { hasStatus: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(setStatus, initialState);
  const [mediaType, setMediaType] = useState<"music" | "movie_tv">("music");
  const [title, setTitle] = useState("");
  const [videoQuery, setVideoQuery] = useState("");
  const [videoResults, setVideoResults] = useState<YoutubeVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<YoutubeVideo | null>(null);
  const [videoSearching, setVideoSearching] = useState(false);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);

  useEffect(() => {
    if (!videoQuery.trim()) return;
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
  }, [videoQuery]);

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
            setSelectedVideo(null);
            setTitle("");
            setVideoQuery("");
            setVideoResults([]);
          }}
        >
          <option value="music">🎧 Listening to…</option>
          <option value="movie_tv">📺 Watching…</option>
        </select>

        {selectedVideo ? (
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
              placeholder={mediaType === "music" ? "Search song or artist…" : "Search movie or show title…"}
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
        <input type="hidden" name="artist" value={selectedVideo?.channelTitle ?? ""} />
        <input type="hidden" name="cover_url" value={selectedVideo?.thumbnailUrl ?? ""} />

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
