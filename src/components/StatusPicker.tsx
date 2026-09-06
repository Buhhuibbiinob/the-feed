"use client";

import {
  MIN_QUERY_LENGTH,
  SEARCH_DEBOUNCE_MS,
  searchMediaClient,
  type MediaResult,
} from "@/lib/trackSearch";

import { useActionState, useEffect, useState } from "react";
import { setStatus, clearStatus, type ProfileFormState } from "@/app/actions/profile";
import { MEDIA_TYPES, MEDIA_VERB_PROMPTS, type MediaType } from "@/lib/media";

const initialState: ProfileFormState = {};

export function StatusPicker({ hasStatus, ownerId }: { hasStatus: boolean; ownerId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(setStatus, initialState);
  const [mediaType, setMediaType] = useState<MediaType>("music");
  const [title, setTitle] = useState("");
  const [videoQuery, setVideoQuery] = useState("");
  const [videoResults, setVideoResults] = useState<MediaResult[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<MediaResult | null>(null);
  const [videoSearching, setVideoSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // See ClubPostForm: collapse on success during render, not in an effect.
  const [lastOk, setLastOk] = useState(state.ok);
  if (state.ok !== lastOk) {
    setLastOk(state.ok);
    if (state.ok) setOpen(false);
  }

  useEffect(() => {
    // This box had no minimum length at all, so a single letter went
    // straight to the API - which made it the most expensive of the four
    // search boxes and the likeliest to trip the rate limit.
    if (videoQuery.trim().length < MIN_QUERY_LENGTH) return;
    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        const answer = await searchMediaClient(videoQuery, { music: mediaType === "music" });
        if (!cancelled && answer) {
          setVideoResults(answer.results);
          setSearchError(answer.error);
        }
      } finally {
        if (!cancelled) setVideoSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
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
        <input type="hidden" name="owner_id" value={ownerId} />
        <select
          value={mediaType}
          onChange={(e) => {
            setMediaType(e.target.value as MediaType);
            setSelectedVideo(null);
            setTitle("");
            setVideoQuery("");
            setVideoResults([]);
          }}
        >
          {MEDIA_TYPES.map((type) => (
            <option value={type} key={type}>
              {MEDIA_VERB_PROMPTS[type]}
            </option>
          ))}
        </select>

        {selectedVideo ? (
          <div className="track-selected">
            {selectedVideo.thumbnailUrl && <img src={selectedVideo.thumbnailUrl} alt="" />}
            <div>
              <b>{selectedVideo.title}</b>
              <div className="sub">{selectedVideo.subtitle}</div>
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
                  // Matched to the threshold the effect tests, so the
                  // spinner never runs for a query that is never sent.
                  setVideoSearching(value.trim().length >= MIN_QUERY_LENGTH);
                }
              }}
              autoComplete="off"
            />
            {videoQuery.trim() && (
              <div className="track-results">
                {videoSearching ? (
                  <div className="track-result">Searching…</div>
                ) : videoResults.length === 0 ? (
                  <div className="track-result">{searchError ?? "No matches."}</div>
                ) : (
                  videoResults.map((video, i) => (
                    <div
                      className="track-result"
                      key={video.youtubeId || `${video.title}-${i}`}
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
                        <div className="sub">{video.subtitle}</div>
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
        <input type="hidden" name="artist" value={selectedVideo?.subtitle ?? ""} />
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
          <input type="hidden" name="owner_id" value={ownerId} />
          <button type="submit" className="comment-action danger">
            Clear status
          </button>
        </form>
      )}
    </div>
  );
}
